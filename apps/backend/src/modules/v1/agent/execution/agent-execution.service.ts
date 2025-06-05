import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ToolsService } from '../../tools/tools.service';
import { AssistantsService } from '../../assistants/assistants.service';
import { AgentSessionOutput, AgentNodeType, FlowNode, FlowEdge } from '../../../../../../../libs/src';
import { firstValueFrom } from 'rxjs';
import { Agent as PrismaAgent, AgentSession } from '@prisma/client';

// Extended Agent interface with workflow properties
interface Agent extends PrismaAgent {
  nodes: any;
  edges: any;
  startNodeId?: string;
  isPublished?: boolean;
  organizationId: string;
}

@Injectable()
export class AgentExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => ToolsService))
    private readonly toolsService: ToolsService,
    @Inject(forwardRef(() => AssistantsService))
    private readonly assistantsService: AssistantsService,
  ) {}

  async initiate(agentId: string, organizationId: string, initialVariables: Record<string, any> = {}, chatId?: string, callSid?: string): Promise<AgentSessionOutput> {
    // Verify the agent exists, is published, and belongs to the organization
    // Use a raw query filter to avoid TypeScript errors with isPublished
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId,
        // Remove isPublished condition temporarily as it's moved to workflow
      },
    }) as unknown as Agent;
    
    // Add the missing properties that would come from Workflow
    (agent as any).nodes = [];
    (agent as any).edges = [];
    (agent as any).startNodeId = '';

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found or not published`);
    }

    // Create a new session
    const session = await this.prisma.agentSession.create({
      data: {
        agentId,
        organizationId,
        variables: initialVariables,
        history: [],
        currentNodeId: agent.startNodeId,
        status: 'ACTIVE',
        chatId: chatId || null,
        callSid: callSid || null,
      },
    });

    // Process the first step
    const sessionWithAgent = { ...session, agent } as AgentSession & { agent: Agent };
    return this.processNextStep(sessionWithAgent, agent as Agent);
  }

  async continue(sessionId: string, userInput?: any): Promise<AgentSessionOutput> {
    // Get the session and agent
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { agent: true },
    }) as unknown as AgentSession & { agent: Agent };
    
    // Ensure agent has the necessary workflow properties
    if (session?.agent && !(session.agent as any).nodes) {
      (session.agent as any).nodes = [];
    }
    if (session?.agent && !(session.agent as any).edges) {
      (session.agent as any).edges = [];
    }

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.status === 'COMPLETED') {
      throw new BadRequestException('This agent session has already been completed');
    }

    // Update the session with the user input
    const updatedVariables = { ...((session.variables as unknown) as Record<string, any>) };
    
    // If we have a currentNodeId and it's a LISTEN node, store the user input in the specified variable
    if (session.currentNodeId) {
      const currentNode = this.findNodeById(session.currentNodeId, (session.agent.nodes as unknown) as FlowNode[]);
      if (currentNode && currentNode.type === AgentNodeType.LISTEN) {
        const listenNodeData = currentNode.data as any;
        if (listenNodeData.variableName && userInput !== undefined) {
          updatedVariables[listenNodeData.variableName] = userInput;
        }
      }
    }

    // Update the session with the new variables
    const updatedSession = await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        variables: updatedVariables,
        history: session.history,
      },
      include: { agent: true },
    }) as unknown as AgentSession & { agent: Agent };

    return this.processNextStep(updatedSession, updatedSession.agent as Agent, userInput);
  }

  private async processNextStep(session: AgentSession & { agent: Agent }, agent: Agent, previousNodeOutput?: any): Promise<AgentSessionOutput> {
    // Get the current node ID
    const currentNodeId = session.currentNodeId || agent.startNodeId;
    if (!currentNodeId) {
      throw new BadRequestException('No current node ID or start node ID found');
    }

    // Find the current node
    const nodes = (agent.nodes as unknown) as FlowNode[];
    const currentNode = this.findNodeById(currentNodeId, nodes);
    if (!currentNode) {
      throw new BadRequestException(`Node with ID ${currentNodeId} not found in agent`);
    }

    let nextNodeId: string | null = null;
    let output: any = null;

    try {
      switch (currentNode.type) {
        case AgentNodeType.START:
          // Start node is just a passthrough
          nextNodeId = this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>);
          break;

        case AgentNodeType.END:
          // End the agent
          await this.prisma.agentSession.update({
            where: { id: session.id },
            data: {
              status: 'COMPLETED',
            },
          });
          output = { message: 'Agent completed' };
          break;

        case AgentNodeType.MESSAGE:
          // Send a message to the user
          const messageNodeData = currentNode.data as any;
          output = {
            message: this.interpolateVariables(messageNodeData.message, (session.variables as unknown) as Record<string, any>),
            ttsProvider: messageNodeData.ttsProvider,
            voiceId: messageNodeData.voiceId,
          };
          nextNodeId = this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>);
          break;

        case AgentNodeType.LISTEN:
          // Wait for user input
          const listenNodeData = currentNode.data as any;
          output = {
            waitForUserInput: true,
            prompt: listenNodeData?.prompt,
          };
          break;

        case AgentNodeType.CHOICE:
          // Present choices to the user
          const choiceNodeData = currentNode.data as any;
          output = {
            message: choiceNodeData.message ? this.interpolateVariables(choiceNodeData.message, (session.variables as unknown) as Record<string, any>) : undefined,
            choices: choiceNodeData.choices.map(choice => ({
              label: this.interpolateVariables(choice.label, (session.variables as unknown) as Record<string, any>),
              value: choice.value,
            })),
          };
          break;

        case AgentNodeType.CONDITION:
          // Evaluate a condition
          const conditionNodeData = currentNode.data as any;
          const variableValue = this.getNestedValue((session.variables as unknown) as Record<string, any>, conditionNodeData.variable);
          let conditionResult = false;

          switch (conditionNodeData.operator) {
            case 'equals':
              conditionResult = variableValue === conditionNodeData.value;
              break;
            case 'notEquals':
              conditionResult = variableValue !== conditionNodeData.value;
              break;
            case 'contains':
              conditionResult = typeof variableValue === 'string' && variableValue.includes(conditionNodeData.value);
              break;
            case 'greaterThan':
              conditionResult = variableValue > conditionNodeData.value;
              break;
            case 'lessThan':
              conditionResult = variableValue < conditionNodeData.value;
              break;
            case 'exists':
              conditionResult = variableValue !== undefined && variableValue !== null;
              break;
            default:
              throw new BadRequestException(`Unknown condition operator: ${conditionNodeData.operator}`);
          }

          nextNodeId = conditionResult
            ? conditionNodeData.trueTargetNodeId || this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>, 'true')
            : conditionNodeData.falseTargetNodeId || this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>, 'false');
          break;

        case AgentNodeType.SET_VARIABLE:
          // Set variables
          const setVariableNodeData = currentNode.data as any;
          const updatedVariables = { ...((session.variables as unknown) as Record<string, any>) };

          for (const assignment of setVariableNodeData.assignments) {
            if (assignment.evaluate) {
              // TODO: Add support for evaluating expressions
              updatedVariables[assignment.variable] = assignment.value;
            } else {
              updatedVariables[assignment.variable] = assignment.value;
            }
          }

          await this.prisma.agentSession.update({
            where: { id: session.id },
            data: {
              variables: updatedVariables,
            },
          });
          session.variables = updatedVariables;
          nextNodeId = this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>);
          break;

        case AgentNodeType.API_CALL:
          // Make an HTTP request
          const apiCallNodeData = currentNode.data as any;
          const url = this.interpolateVariables(apiCallNodeData.url, (session.variables as unknown) as Record<string, any>);
          const method = apiCallNodeData.method;
          const headers = apiCallNodeData.headers
            ? Object.entries(apiCallNodeData.headers).reduce((acc, [key, value]) => {
                acc[key] = this.interpolateVariables(value as string, (session.variables as unknown) as Record<string, any>);
                return acc;
              }, {})
            : {};
          const body = apiCallNodeData.body
            ? JSON.parse(this.interpolateVariables(apiCallNodeData.body, (session.variables as unknown) as Record<string, any>))
            : undefined;

          try {
            const response = await firstValueFrom(
              this.httpService.request({
                method,
                url,
                headers,
                data: body,
              })
            );

            output = response.data;

            // Store the response in a variable if specified
            if (apiCallNodeData.responseVariableName) {
              const updatedVariables = { ...((session.variables as unknown) as Record<string, any>), [apiCallNodeData.responseVariableName]: output };
              await this.prisma.agentSession.update({
                where: { id: session.id },
                data: {
                  variables: updatedVariables,
                },
              });
              session.variables = updatedVariables;
            }
          } catch (error) {
            output = { error: error.message };
          }

          nextNodeId = this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>);
          break;

        case AgentNodeType.TOOL_CALL:
          const toolCallNodeData = currentNode.data as any;
          const toolId = toolCallNodeData.toolId;
          const inputMapping = toolCallNodeData.inputMapping || {};

          // Prepare the tool input by mapping agent variables
          const toolInput = Object.entries(inputMapping).reduce((acc, [key, value]) => {
            acc[key] = this.interpolateVariables(value as string, (session.variables as unknown) as Record<string, any>);
            return acc;
          }, {});

          try {
            // Execute the tool
            // Use session's organizationId instead of agent's (they should be the same)
            const toolResult = await this.toolsService.executeToolById(
              toolId,
              toolInput,
              session.organizationId // Use session.organizationId which is guaranteed to exist
            );

            output = toolResult;

            // Store the tool output in a variable if specified
            if (toolCallNodeData.outputVariableName) {
              const updatedVariables = { ...((session.variables as unknown) as Record<string, any>), [toolCallNodeData.outputVariableName]: output };
              await this.prisma.agentSession.update({
                where: { id: session.id },
                data: {
                  variables: updatedVariables,
                },
              });
              session.variables = updatedVariables;
            }
          } catch (error) {
            output = { error: error.message };
          }

          nextNodeId = this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>);
          break;

        // Add other node types as needed...

        default:
          throw new BadRequestException(`Unsupported node type: ${currentNode.type}`);
      }

      // Update the session with the next node ID
      if (nextNodeId) {
        await this.prisma.agentSession.update({
          where: { id: session.id },
          data: {
            currentNodeId: nextNodeId,
          },
        });
        session.currentNodeId = nextNodeId;
      }

      // If we have a next node and it's not a LISTEN or CHOICE node, process it immediately
      if (
        nextNodeId &&
        currentNode.type !== AgentNodeType.LISTEN &&
        currentNode.type !== AgentNodeType.CHOICE
      ) {
        const nextNode = this.findNodeById(nextNodeId, nodes);
        if (
          nextNode &&
          nextNode.type !== AgentNodeType.LISTEN &&
          nextNode.type !== AgentNodeType.CHOICE &&
          nextNode.type !== AgentNodeType.END
        ) {
          return this.processNextStep(session, agent, output);
        }
      }

      // Add the current step to the history
      const history = Array.isArray(session.history) ? session.history : [];
      const historyEntry = {
        nodeId: currentNodeId,
        nodeType: currentNode.type,
        timestamp: new Date(),
        input: previousNodeOutput,
        output,
      };

      await this.prisma.agentSession.update({
        where: { id: session.id },
        data: {
          history: [...history, historyEntry],
        },
      });

      // Return the output
      return {
        sessionId: session.id,
        status: currentNode.type === AgentNodeType.END ? 'COMPLETED' : 'ACTIVE',
        currentNodeId: session.currentNodeId,
        output,
        nextAction: {
          type: currentNode.type.toLowerCase(),
          data: output
        }
      };
    } catch (error) {
      // Handle errors
      console.error('Error processing agent step:', error);
      throw new BadRequestException(`Error processing agent step: ${error.message}`);
    }
  }

  private findNodeById(nodeId: string, nodes: FlowNode[]): FlowNode | undefined {
    return nodes.find(node => node.id === nodeId);
  }

  private findNextNodeId(
    currentNodeId: string,
    agent: Agent,
    variables: Record<string, any>,
    conditionResult?: string,
  ): string | null {
    const edges = (agent.edges as unknown) as FlowEdge[];
    const possibleEdges = edges.filter(edge => edge.source === currentNodeId);

    if (possibleEdges.length === 0) {
      return null;
    }

    // If we have a condition result, filter edges by it
    if (conditionResult) {
      const conditionEdge = possibleEdges.find(edge => edge.sourceHandle === conditionResult);
      return conditionEdge ? conditionEdge.target : null;
    }

    // Otherwise, return the first edge
    return possibleEdges[0].target;
  }

  private interpolateVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\${([^}]+)}/g, (match, variablePath) => {
      const value = this.getNestedValue(variables, variablePath);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }
}
