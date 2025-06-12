import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ToolsService } from '../../tools/tools.service';
import { AssistantsService } from '../../assistants/assistants.service';
import { ChatsService } from '../../chats/chats.service';
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
  private readonly logger = new Logger(AgentExecutionService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => ToolsService))
    private readonly toolsService: ToolsService,
    @Inject(forwardRef(() => AssistantsService))
    private readonly assistantsService: AssistantsService,
    @Inject(forwardRef(() => ChatsService))
    private readonly chatsService: ChatsService,
  ) {}

  async initiate(agentId: string, organizationId: string, initialVariables: Record<string, any> = {}, chatId?: string, callSid?: string): Promise<AgentSessionOutput> {
    this.logger.log(`[AGENT_EXEC] Initiating agent execution for agent ${agentId} in org ${organizationId}`);
    
    // Verify the agent exists, is published, and belongs to the organization
    // Use a raw query filter to avoid TypeScript errors with isPublished
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId,
        // Remove isPublished condition temporarily as it's moved to workflow
      },
    }) as unknown as Agent;
    
    // Cast to any to access properties safely in logs
    const agentInfo = agent as any;
    this.logger.log(`[AGENT_EXEC] Agent found: ${JSON.stringify({
      id: agentInfo?.id, 
      organizationId: agentInfo?.organizationId
    })}`);
    
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
    // Cast to any for safe property access in logs
    const agentInfo = agent as any;
    
    this.logger.log(`[AGENT_EXEC] Starting processNextStep for agent ${agentInfo.id || 'unknown'}, session ${session.id}`);
    this.logger.debug(`[AGENT_EXEC] Full agent data: ${JSON.stringify(agent)}`);
    
    // Get the current node ID
    const currentNodeId = session.currentNodeId || agent.startNodeId;
    this.logger.log(`[AGENT_EXEC] Current node ID: ${currentNodeId}`);
    
    if (!currentNodeId) {
      this.logger.error(`[AGENT_EXEC] No current node ID or start node ID found for agent ${agentInfo.id || 'unknown'}`);
      throw new BadRequestException('No current node ID or start node ID found');
    }

    // Find the current node
    const nodes = (agent.nodes as unknown) as FlowNode[];
    this.logger.log(`[AGENT_EXEC] Total nodes in agent: ${nodes?.length || 0}`);
    this.logger.debug(`[AGENT_EXEC] All nodes: ${JSON.stringify(nodes)}`);
    
    const currentNode = this.findNodeById(currentNodeId, nodes);
    this.logger.log(`[AGENT_EXEC] Current node found: ${!!currentNode}, type: ${currentNode?.type}, id: ${currentNode?.id}`);
    this.logger.debug(`[AGENT_EXEC] Current node data: ${JSON.stringify(currentNode)}`);
    
    if (!currentNode) {
      this.logger.error(`[AGENT_EXEC] Node with ID ${currentNodeId} not found in agent ${agentInfo.id || 'unknown'}`);
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

        case AgentNodeType.ASSISTANT:
          // Handle assistant node execution
          const assistantNodeData = currentNode.data as any;
          
          // Detailed logging of the ASSISTANT node data for debugging
          this.logger.log(`[AGENT_EXEC] Processing ASSISTANT node with data: ${JSON.stringify(assistantNodeData)}`);
          
          // Workflow nodes store the assistantId in apiAssistantId field
          const assistantId = assistantNodeData.apiAssistantId || assistantNodeData.assistantId;
          const inputVariableName = assistantNodeData.inputVariableName;
          
          // Log what field we found the assistantId in
          if (assistantNodeData.apiAssistantId) {
            this.logger.log(`[AGENT_EXEC] Found assistantId in apiAssistantId field: ${assistantNodeData.apiAssistantId}`);
          } else if (assistantNodeData.assistantId) {
            this.logger.log(`[AGENT_EXEC] Found assistantId in assistantId field: ${assistantNodeData.assistantId}`);
          } else {
            this.logger.error(`[AGENT_EXEC] No assistantId found in ASSISTANT node data`);  
          }
          
          if (!assistantId) {
            this.logger.error(`[AGENT_EXEC] Assistant ID is required in ASSISTANT node data (as apiAssistantId or assistantId)`);
            throw new BadRequestException('Assistant ID is required in ASSISTANT node data (as apiAssistantId or assistantId)');
          }
          
          this.logger.log(`[AGENT_EXEC] Processing ASSISTANT node with assistantId: ${assistantId}`);
          
          // Verify the assistant exists
          this.logger.log(`[AGENT_EXEC] Verifying assistant with ID ${assistantId} exists for org ${session.organizationId}`);
          
          let assistantDetails: any;
          try {
            assistantDetails = await this.assistantsService.getAssistantById(assistantId, session.organizationId);
            
            if (!assistantDetails) {
              this.logger.error(`[AGENT_EXEC] Assistant with ID ${assistantId} not found for org ${session.organizationId}`);
              throw new BadRequestException(`Assistant with ID ${assistantId} not found`);
            }
            
            this.logger.log(`[AGENT_EXEC] Assistant found: ${JSON.stringify({
              id: assistantDetails.id,
              organizationId: assistantDetails.organizationId,
              hasKnowledgeBase: !!assistantDetails.knowledgeBaseId
            })}`);
          } catch (error) {
            this.logger.error(`[AGENT_EXEC] Error verifying assistant: ${error.message}`);
            throw error;
          }
          
          try {
            // Get the input from variables or session input
            this.logger.log(`[AGENT_EXEC] Getting input for assistant from ${inputVariableName ? `variable '${inputVariableName}'` : 'previous node output'}`);
            
            const variables = (session.variables as unknown) as Record<string, any>;
            this.logger.debug(`[AGENT_EXEC] Available variables: ${JSON.stringify(variables)}`);
            
            const userInput = inputVariableName
              ? this.getNestedValue(variables, inputVariableName)
              : previousNodeOutput || '';
            
            this.logger.log(`[AGENT_EXEC] Retrieved user input of length: ${userInput ? userInput.length : 0} characters`);
            
            if (!userInput) {
              this.logger.error(`[AGENT_EXEC] No valid input for assistant node. Input variable "${inputVariableName || 'none'}" is empty or not found`);
              throw new BadRequestException(`No valid input for assistant node. Input variable "${inputVariableName || 'none'}" is empty or not found`);
            }
            
            this.logger.log(`[AGENT_EXEC] Assistant node input preview: ${userInput.substring(0, 100)}...`);
            
            let chatId: string;
            
            // Check if a chat already exists for this session
            const existingChats = await this.prisma.chat.findMany({
              where: {
                sessionId: session.id,
                assistantId: assistantId,
                organizationId: session.organizationId,
              }
            });
            
            // Reuse existing chat or create a new one
            if (existingChats && existingChats.length > 0) {
              chatId = existingChats[0].id;
              this.logger.log(`Using existing chat ${chatId} for session ${session.id}`);
            } else {
              const newChat = await this.chatsService.createChat({
                assistantId,
                organizationId: session.organizationId,
                name: `Agent Session ${session.id}`,
                sessionId: session.id,
                sessionType: 'chat' // Must be 'chat' or 'call' according to type definition
              });
              
              chatId = newChat.id;
              this.logger.log(`Created new chat ${chatId} for session ${session.id}`);
            }
            
            // Get existing messages to provide context
            const existingMessages = await this.prisma.message.findMany({
              where: { chatId },
              orderBy: { sequenceId: 'asc' },
            });
            
            // Get the next sequence ID for messages
            const nextSequenceId = existingMessages.length > 0 
              ? Math.max(...existingMessages.map(m => m.sequenceId || 0)) + 1 
              : 1;
            
            this.logger.log(`Creating user message with sequence ID ${nextSequenceId}`);
            
            // Create a message for the user input
            const message = await this.chatsService.createMessage(
              chatId,
              {
                content: userInput,
                role: 'user',
                type: 'text',
                sequenceId: nextSequenceId 
              },
              session.organizationId
            );
            
            this.logger.log(`[AGENT_EXEC] Delegating to assistant service with ID ${assistantId} - all RAG/context handled by assistant service`);
            
            // Call the assistantsService to generate a response - passing arguments separately
            const assistantResponse = await this.assistantsService.generateAssistantResponse(
              assistantId,
              userInput,
              session.organizationId
            );
            
            // Save the response as output
            output = assistantResponse || 'No response generated';
            
            this.logger.log(`[AGENT_EXEC] Assistant response generated successfully (${output.length} chars)`);
            
            // Store the assistant response in the output variable if specified
            if (assistantNodeData.outputVariableName) {
              const updatedVariables = { ...((session.variables as unknown) as Record<string, any>), [assistantNodeData.outputVariableName]: output };
              await this.prisma.agentSession.update({
                where: { id: session.id },
                data: {
                  variables: updatedVariables,
                },
              });
              session.variables = updatedVariables;
              
              this.logger.log(`Stored assistant response in variable: ${assistantNodeData.outputVariableName}`);
            }
          } catch (error) {
            this.logger.error(`Error in ASSISTANT node: ${error.message}`, error.stack);
            output = { error: error.message };
          }
          
          nextNodeId = this.findNextNodeId(currentNodeId, agent, (session.variables as unknown) as Record<string, any>);
          break;

        case AgentNodeType.KNOWLEDGE_BASE_SEARCH:
          const kbNodeData = currentNode.data as any;
          const kbId = kbNodeData.knowledgeBaseId;
          const queryVariableName = kbNodeData.queryVariableName;
          
          if (!kbId) {
            throw new BadRequestException('Knowledge Base ID is required in KNOWLEDGE_BASE_SEARCH node data');
          }
          
          if (!queryVariableName) {
            throw new BadRequestException('Query variable name is required in KNOWLEDGE_BASE_SEARCH node data');
          }
          
          try {
            this.logger.log(`Processing KNOWLEDGE_BASE_SEARCH node with KB ID: ${kbId}`);
            
            // Get the query from variables
            const query = this.getNestedValue(
              (session.variables as unknown) as Record<string, any>, 
              queryVariableName
            );
            
            if (!query) {
              throw new BadRequestException(`Query variable "${queryVariableName}" is empty or not found`);
            }
            
            this.logger.log(`Query for knowledge base search: ${query}`);
            
            // First, verify the knowledge base exists and belongs to the organization
            const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
              where: {
                id: kbId,
                organizationId: session.organizationId
              }
            });
            
            if (!knowledgeBase) {
              throw new NotFoundException(`Knowledge base with ID ${kbId} not found or not accessible`);
            }
            
            // Get chunks from the knowledge base that might be relevant
            // In a real implementation, this would use a vector search or other RAG technique
            const chunks = await this.prisma.chunkMetadata.findMany({
              where: {
                knowledgeBaseId: kbId
              },
              take: 5,
              include: {
                source: {
                  select: {
                    id: true,
                    file: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            });
            
            // Format results in a useful way
            const searchResults = chunks.map(chunk => {
              return {
                content: chunk.textPreview || 'No content available', // Using textPreview instead of text
                chunkIndex: chunk.chunkIndex,
                sourceId: chunk.sourceId,
                fileName: chunk.source?.file?.name || 'Unknown',
                knowledgeBaseId: kbId,
                score: 1.0, // Placeholder score since we're not doing real vector search yet
                query
              };
            });
            
            this.logger.log(`Found ${searchResults.length} relevant chunks in knowledge base ${kbId}`);
            
            output = {
              results: searchResults,
              query
            };
            
            // Store the search results in the output variable if specified
            if (kbNodeData.outputVariableName) {
              const updatedVariables = { ...((session.variables as unknown) as Record<string, any>), [kbNodeData.outputVariableName]: searchResults };
              await this.prisma.agentSession.update({
                where: { id: session.id },
                data: {
                  variables: updatedVariables,
                },
              });
              session.variables = updatedVariables;
            }
          } catch (error) {
            this.logger.error(`Error in KNOWLEDGE_BASE_SEARCH node: ${error.message}`, error.stack);
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
