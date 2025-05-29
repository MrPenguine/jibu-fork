import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ToolsService } from '../../tools/tools.service';
import { AssistantsService } from '../../assistants/assistants.service';
import { WorkflowSessionOutput, WorkflowNodeType, FlowNode, FlowEdge } from '../../../../../../../libs/src';
import { firstValueFrom } from 'rxjs';
import { Workflow, WorkflowSession } from '@prisma/client';

@Injectable()
export class WorkflowExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => ToolsService))
    private readonly toolsService: ToolsService,
    @Inject(forwardRef(() => AssistantsService))
    private readonly assistantsService: AssistantsService,
  ) {}

  async initiate(workflowId: string, organizationId: string, initialVariables: Record<string, any> = {}, chatId?: string, callSid?: string): Promise<WorkflowSessionOutput> {
    // Verify the workflow exists, is published, and belongs to the organization
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId,
        isPublished: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found or not published`);
    }

    // Create a new session
    const session = await this.prisma.workflowSession.create({
      data: {
        workflowId,
        organizationId,
        variables: initialVariables,
        history: [],
        currentNodeId: workflow.startNodeId,
        status: 'ACTIVE',
        chatId: chatId || null,
        callSid: callSid || null,
      },
    });

    // Process the first step
    const sessionWithWorkflow = { ...session, workflow } as WorkflowSession & { workflow: Workflow };
    return this.processNextStep(sessionWithWorkflow, workflow);
  }

  async continue(sessionId: string, userInput?: any): Promise<WorkflowSessionOutput> {
    // Get the session and workflow
    const session = await this.prisma.workflowSession.findUnique({
      where: { id: sessionId },
      include: { workflow: true },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.status === 'COMPLETED') {
      throw new BadRequestException('This workflow session has already been completed');
    }

    // Update the session with the user input
    const updatedVariables = { ...((session.variables as unknown) as Record<string, any>) };
    
    // If we have a currentNodeId and it's a LISTEN node, store the user input in the specified variable
    if (session.currentNodeId) {
      const currentNode = this.findNodeById(session.currentNodeId, (session.workflow.nodes as unknown) as FlowNode[]);
      if (currentNode && currentNode.type === WorkflowNodeType.LISTEN) {
        const listenNodeData = currentNode.data as any;
        if (listenNodeData.variableName && userInput !== undefined) {
          updatedVariables[listenNodeData.variableName] = userInput;
        }
      }
    }

    // Update the session with the new variables
    const updatedSession = await this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        variables: updatedVariables,
      },
      include: { workflow: true },
    });

    return this.processNextStep(updatedSession, updatedSession.workflow, userInput);
  }

  private async processNextStep(session: WorkflowSession & { workflow: Workflow }, workflow: Workflow, previousNodeOutput?: any): Promise<WorkflowSessionOutput> {
    // Get the current node ID
    const currentNodeId = session.currentNodeId || workflow.startNodeId;
    if (!currentNodeId) {
      throw new BadRequestException('No current node ID or start node ID found');
    }

    // Find the current node
    const nodes = (workflow.nodes as unknown) as FlowNode[];
    const currentNode = this.findNodeById(currentNodeId, nodes);
    if (!currentNode) {
      throw new BadRequestException(`Node with ID ${currentNodeId} not found in workflow`);
    }

    let nextNodeId: string | null = null;
    let output: any = null;

    try {
      switch (currentNode.type) {
        case WorkflowNodeType.START:
          // Start node is just a passthrough
          nextNodeId = this.findNextNodeId(currentNodeId, workflow, (session.variables as unknown) as Record<string, any>);
          break;

        case WorkflowNodeType.END:
          // End the workflow
          await this.prisma.workflowSession.update({
            where: { id: session.id },
            data: {
              status: 'COMPLETED',
            },
          });
          output = { message: 'Workflow completed' };
          break;

        case WorkflowNodeType.MESSAGE:
          // Send a message to the user
          const messageNodeData = currentNode.data as any;
          output = {
            message: this.interpolateVariables(messageNodeData.message, (session.variables as unknown) as Record<string, any>),
            ttsProvider: messageNodeData.ttsProvider,
            voiceId: messageNodeData.voiceId,
          };
          nextNodeId = this.findNextNodeId(currentNodeId, workflow, (session.variables as unknown) as Record<string, any>);
          break;

        case WorkflowNodeType.LISTEN:
          // Wait for user input
          const listenNodeData = currentNode.data as any;
          output = {
            waitForUserInput: true,
            prompt: listenNodeData?.prompt,
          };
          break;

        case WorkflowNodeType.CHOICE:
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

        case WorkflowNodeType.CONDITION:
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
            ? conditionNodeData.trueTargetNodeId || this.findNextNodeId(currentNodeId, workflow, (session.variables as unknown) as Record<string, any>, 'true')
            : conditionNodeData.falseTargetNodeId || this.findNextNodeId(currentNodeId, workflow, (session.variables as unknown) as Record<string, any>, 'false');
          break;

        case WorkflowNodeType.SET_VARIABLE:
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

          await this.prisma.workflowSession.update({
            where: { id: session.id },
            data: {
              variables: updatedVariables,
            },
          });
          session.variables = updatedVariables;
          nextNodeId = this.findNextNodeId(currentNodeId, workflow, (session.variables as unknown) as Record<string, any>);
          break;

        case WorkflowNodeType.API_CALL:
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
              await this.prisma.workflowSession.update({
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

          nextNodeId = this.findNextNodeId(currentNodeId, workflow, (session.variables as unknown) as Record<string, any>);
          break;

        case WorkflowNodeType.TOOL_CALL:
          const toolCallNodeData = currentNode.data as any;
          const toolId = toolCallNodeData.toolId;
          const inputMapping = toolCallNodeData.inputMapping || {};

          // Prepare the tool input by mapping workflow variables
          const toolInput = Object.entries(inputMapping).reduce((acc, [key, value]) => {
            acc[key] = this.interpolateVariables(value as string, (session.variables as unknown) as Record<string, any>);
            return acc;
          }, {});

          try {
            // Execute the tool
            const toolResult = await this.toolsService.executeToolById(
              toolId,
              toolInput,
              session.workflow.organizationId
            );

            output = toolResult;

            // Store the tool output in a variable if specified
            if (toolCallNodeData.outputVariableName) {
              const updatedVariables = { ...((session.variables as unknown) as Record<string, any>), [toolCallNodeData.outputVariableName]: output };
              await this.prisma.workflowSession.update({
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

          nextNodeId = this.findNextNodeId(currentNodeId, workflow, (session.variables as unknown) as Record<string, any>);
          break;

        // Add other node types as needed...

        default:
          throw new BadRequestException(`Unsupported node type: ${currentNode.type}`);
      }

      // Update the session with the next node ID
      if (nextNodeId) {
        await this.prisma.workflowSession.update({
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
        currentNode.type !== WorkflowNodeType.LISTEN &&
        currentNode.type !== WorkflowNodeType.CHOICE
      ) {
        const nextNode = this.findNodeById(nextNodeId, nodes);
        if (
          nextNode &&
          nextNode.type !== WorkflowNodeType.LISTEN &&
          nextNode.type !== WorkflowNodeType.CHOICE &&
          nextNode.type !== WorkflowNodeType.END
        ) {
          return this.processNextStep(session, workflow, output);
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

      await this.prisma.workflowSession.update({
        where: { id: session.id },
        data: {
          history: [...history, historyEntry],
        },
      });

      // Return the output
      return {
        sessionId: session.id,
        status: currentNode.type === WorkflowNodeType.END ? 'COMPLETED' : 'ACTIVE',
        currentNodeId: session.currentNodeId,
        output,
        nextAction: {
          type: currentNode.type.toLowerCase(),
          data: output
        }
      };
    } catch (error) {
      // Handle errors
      console.error('Error processing workflow step:', error);
      throw new BadRequestException(`Error processing workflow step: ${error.message}`);
    }
  }

  private findNodeById(nodeId: string, nodes: FlowNode[]): FlowNode | undefined {
    return nodes.find(node => node.id === nodeId);
  }

  private findNextNodeId(
    currentNodeId: string,
    workflow: Workflow,
    variables: Record<string, any>,
    conditionResult?: string,
  ): string | null {
    const edges = (workflow.edges as unknown) as FlowEdge[];
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
