import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAgentService, AgentRequest, AgentResponse } from '../../interfaces/agent.interface';
import { LangflowPayload } from '../../agent.types';
import fetch from 'node-fetch';

@Injectable()
export class LangflowAgentService implements IAgentService {
  private readonly logger = new Logger(LangflowAgentService.name);
  private readonly langflowUrl: string;
  private readonly langflowFlowId: string;

  constructor(private configService: ConfigService) {
    this.langflowUrl = this.configService.get<string>('LANGFLOW_API_URL', 'http://localhost:7860');
    this.langflowFlowId = this.configService.get<string>('LANGFLOW_FLOW_ID', 'a59a91f2-08a8-431d-bd4f-8da5eec9792d');
    this.logger.log(`Initialized LangflowAgentService with URL: ${this.langflowUrl}`);
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Try the new API endpoint structure
      const response = await fetch(`${this.langflowUrl}/api/v1/health`);
      if (response.ok) {
        // Check if the response is HTML or JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return true;
        } else {
          this.logger.warn('Langflow returned HTML instead of JSON. API endpoints may have changed.');
          return false;
        }
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to connect to Langflow: ${error.message}`);
      return false;
    }
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const payload = this.buildLangflowPayload(request);
      
      const response = await fetch(`${this.langflowUrl}/api/v1/run/${this.langflowFlowId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Langflow API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Received response from Langflow: ${JSON.stringify(data)}`);
      
      // Handle the new response format
      let output = '';
      let history = null;
      
      if (data.session_id && data.outputs && Array.isArray(data.outputs)) {
        // New format after node removal
        this.logger.log('Detected new response format with session_id and outputs array');
        // Extract output from the new structure if available
        if (data.outputs.length > 0) {
          const outputData = data.outputs[0].outputs;
          
          // Check if outputData contains history
          if (outputData && typeof outputData === 'object' && outputData.history) {
            this.logger.log('Found history in response');
            history = outputData.history;
            // Extract the last message from history if available
            if (Array.isArray(history) && history.length > 0) {
              const lastMessage = history[history.length - 1];
              if (lastMessage && lastMessage.content) {
                output = lastMessage.content;
              } else {
                output = 'No content in the last message of history.';
              }
            } else {
              output = 'History is empty.';
            }
          } else {
            // No history, use the output directly
            output = typeof outputData === 'string' ? outputData : JSON.stringify(outputData);
          }
        } else {
          output = 'No output generated from the language model.';
        }
      } else {
        // Original format
        output = data.result || data.output || JSON.stringify(data);
      }
      
      // Use the user's sessionId if provided, otherwise use the one from the response
      const sessionId = request.sessionId || data.session_id || 'anonymous';
      
      return {
        output,
        sessionId,
        metadata: { 
          rawResponse: data,
          history: history
        }
      };
    } catch (error) {
      this.logger.error(`Error processing request: ${error.message}`);
      throw error;
    }
  }

  async *processStreamingRequest(request: AgentRequest): AsyncIterable<AgentResponse> {
    try {
      // Set streaming to true in the config
      if (request.config) {
        request.config.stream = true;
      }
      
      const payload = this.buildLangflowPayload(request);
      
      // Use GET with query parameters for the stream endpoint
      const queryParams = new URLSearchParams();
      queryParams.append('input_value', payload.input_value);
      queryParams.append('output_type', payload.output_type || 'chat');
      queryParams.append('input_type', payload.input_type || 'chat');
      
      // Use the request sessionId if provided, otherwise use the payload session_id
      const sessionId = request.sessionId || payload.session_id || 'anonymous';
      queryParams.append('session_id', sessionId);
      
      const streamUrl = `${this.langflowUrl}/api/v1/run/${this.langflowFlowId}/stream?${queryParams}`;
      this.logger.log(`Making request to Langflow stream endpoint: ${streamUrl}`);
      
      const response = await fetch(streamUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(`Langflow API error: ${response.status} ${response.statusText}`);
        throw new Error(`Langflow API error: ${response.status} ${response.statusText}`);
      }

      this.logger.log(`Successfully connected to Langflow stream endpoint`);
      
      // Log response headers for troubleshooting
      this.logger.log('Response headers:');
      response.headers.forEach((value, name) => {
        this.logger.log(`${name}: ${value}`);
      });

      // Check if we have a streaming response or a regular JSON response
      if (response.headers.get('content-type')?.includes('application/json')) {
        // Handle regular JSON response
        this.logger.log('Received JSON response instead of stream');
        const data = await response.json();
        this.logger.log(`JSON response: ${JSON.stringify(data)}`);
        
        // Handle the new response format
        let output = '';
        let history = null;
        
        if (data.session_id && data.outputs && Array.isArray(data.outputs)) {
          // New format after node removal
          this.logger.log('Detected new response format with session_id and outputs array');
          // Extract output from the new structure if available
          if (data.outputs.length > 0) {
            const outputData = data.outputs[0].outputs;
            
            // Check if outputData contains history
            if (outputData && typeof outputData === 'object' && outputData.history) {
              this.logger.log('Found history in response');
              history = outputData.history;
              // Extract the last message from history if available
              if (Array.isArray(history) && history.length > 0) {
                const lastMessage = history[history.length - 1];
                if (lastMessage && lastMessage.content) {
                  output = lastMessage.content;
                } else {
                  output = 'No content in the last message of history.';
                }
              } else {
                output = 'History is empty.';
              }
            } else {
              // No history, use the output directly
              output = typeof outputData === 'string' ? outputData : JSON.stringify(outputData);
            }
          } else {
            output = 'No output generated from the language model.';
          }
        } else {
          // Original format
          output = data.result || data.output || JSON.stringify(data);
        }
        
        // Use the user's sessionId if provided, otherwise use the one from the response
        const responseSessionId = request.sessionId || data.session_id || 'anonymous';
        
        yield {
          output,
          sessionId: responseSessionId,
          metadata: { 
            rawResponse: data,
            history: history
          }
        };
        return;
      }
      
      // If we don't have a readable stream, fall back to text
      if (!response.body || typeof response.body.getReader !== 'function') {
        this.logger.log('Response body is not a readable stream, falling back to text');
        const text = await response.text();
        
        // Log the first 500 characters of the response for troubleshooting
        this.logger.log(`Raw response (first 500 chars): ${text.substring(0, 500)}...`);
        
        // Check if the response is HTML (likely the Langflow UI)
        if (text.includes('<!doctype html>') || text.includes('<html')) {
          this.logger.error('Received HTML response instead of API response. Langflow API endpoint may be misconfigured.');
          
          // Fall back to non-streaming request
          this.logger.log('Falling back to non-streaming request');
          try {
            // Try direct API call
            this.logger.log('Trying direct API call to /api/v1/run endpoint');
            const nonStreamingUrl = `${this.langflowUrl}/api/v1/run/${this.langflowFlowId}`;
            const nonStreamingResponse = await fetch(nonStreamingUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });
            
            if (!nonStreamingResponse.ok) {
              this.logger.error(`Langflow API error: ${nonStreamingResponse.status} ${nonStreamingResponse.statusText}`);
              const errorText = await nonStreamingResponse.text();
              this.logger.error(`Error response: ${errorText}`);
              
              // Check for Qdrant connection error
              if (errorText.includes('Connection refused') && errorText.includes('Qdrant')) {
                yield {
                  output: 'The Langflow agent is having trouble connecting to the Qdrant vector database. Please make sure Qdrant is running and properly configured in your Langflow setup.',
                  sessionId: request.sessionId,
                  metadata: { error: 'Qdrant connection error', rawError: errorText }
                };
                return;
              }
              
              throw new Error(`Langflow API error: ${nonStreamingResponse.status} ${nonStreamingResponse.statusText}`);
            }
            
            const data = await nonStreamingResponse.json();
            this.logger.log(`Non-streaming response: ${JSON.stringify(data)}`);
            yield {
              output: data.result || data.output || JSON.stringify(data),
              sessionId: request.sessionId,
              metadata: { rawResponse: data }
            };
          } catch (error) {
            this.logger.error(`Error in fallback request: ${error.message}`);
            
            // Check for Qdrant connection error in the error message
            if (error.message.includes('Connection refused') && error.message.includes('Qdrant')) {
              yield {
                output: 'The Langflow agent is having trouble connecting to the Qdrant vector database. Please make sure Qdrant is running and properly configured in your Langflow setup.',
                sessionId: request.sessionId,
                metadata: { error: 'Qdrant connection error' }
              };
              return;
            }
            
            // If non-streaming also fails, return a dummy response
            yield {
              output: 'Sorry, I encountered an issue connecting to the language model. Please try again later.',
              sessionId: request.sessionId,
              metadata: { error: 'Langflow API misconfiguration' }
            };
          }
          return;
        }
        
        try {
          // Try to parse as JSON
          const data = JSON.parse(text);
          
          // Handle the new response format
          let output = '';
          let history = null;
          
          if (data.session_id && data.outputs && Array.isArray(data.outputs)) {
            // New format after node removal
            this.logger.log('Detected new response format with session_id and outputs array');
            // Extract output from the new structure if available
            if (data.outputs.length > 0) {
              const outputData = data.outputs[0].outputs;
              
              // Check if outputData contains history
              if (outputData && typeof outputData === 'object' && outputData.history) {
                this.logger.log('Found history in response');
                history = outputData.history;
                // Extract the last message from history if available
                if (Array.isArray(history) && history.length > 0) {
                  const lastMessage = history[history.length - 1];
                  if (lastMessage && lastMessage.content) {
                    output = lastMessage.content;
                  } else {
                    output = 'No content in the last message of history.';
                  }
                } else {
                  output = 'History is empty.';
                }
              } else {
                // No history, use the output directly
                output = typeof outputData === 'string' ? outputData : JSON.stringify(outputData);
              }
            } else {
              output = 'No output generated from the language model.';
            }
          } else {
            // Original format
            output = data.result || data.output || JSON.stringify(data);
          }
          
          // Use the user's sessionId if provided, otherwise use the one from the response
          const responseSessionId = request.sessionId || data.session_id || 'anonymous';
          
          yield {
            output,
            sessionId: responseSessionId,
            metadata: { 
              rawResponse: data,
              history: history
            }
          };
        } catch (e) {
          // Return as plain text if not JSON
          yield {
            output: text || 'No response from Langflow API',
            sessionId: request.sessionId,
            metadata: { rawText: text }
          };
        }
        return;
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete JSON objects from the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              yield {
                output: data.chunk || data.result || '',
                sessionId: sessionId,
                metadata: { type: 'chunk', rawData: data }
              };
            } catch (e) {
              this.logger.warn(`Failed to parse streaming response: ${e.message}`);
            }
          }
        }
      }
      
      // Process any remaining data in the buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          yield {
            output: data.chunk || data.result || '',
            sessionId: sessionId,
            metadata: { type: 'final', rawData: data }
          };
        } catch (e) {
          this.logger.warn(`Failed to parse final streaming response: ${e.message}`);
        }
      }
      
    } catch (error) {
      this.logger.error(`Error processing streaming request: ${error.message}`);
      throw error;
    }
  }

  private buildLangflowPayload(request: AgentRequest): LangflowPayload {
    const { assistantId, clientId, knowledgeBaseId, stream } = request.config || {};
    
    // Build the tweaks object based on the provided IDs
    const tweaks: Record<string, any> = {};
    
    // ChatInput component tweaks
    if (assistantId || clientId) {
      tweaks['ChatInput-nli0T'] = {
        ...(assistantId && { sender_name: assistantId }),
        ...(clientId && { session_id: clientId })
      };
    }
    
    // QdrantVectorStore component tweaks
    if (knowledgeBaseId) {
      tweaks['QdrantVectorStoreComponent-UZOpF'] = {
        collection_name: knowledgeBaseId
      };
    }
    
    // Model streaming tweaks
    if (stream !== undefined) {
      tweaks['GoogleGenerativeAIModel-A6PV0'] = {
        stream: stream
      };
    }
    
    // Use the request sessionId if provided, otherwise use clientId or a default
    const sessionId = request.sessionId || clientId || 'anonymous';
    this.logger.log(`Using sessionId: ${sessionId} for Langflow request`);
    
    return {
      input_value: request.input,
      output_type: request.outputType || 'chat',
      input_type: request.inputType || 'chat',
      session_id: sessionId,
      tweaks: Object.keys(tweaks).length > 0 ? tweaks : undefined
    };
  }
}
