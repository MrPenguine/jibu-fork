import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAgentService, AgentRequest, AgentResponse } from '../../interfaces/agent.interface';
import { PrismaService } from '../../../../core/database/prisma.service';
import { ILlmService } from '../../../llm/interfaces/llm.interface';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import OpenAI from 'openai';
import axios from 'axios';

@Injectable()
export class LangchainAgentService implements IAgentService {
  private readonly logger = new Logger(LangchainAgentService.name);
  private readonly googleApiKey: string;
  private readonly xaiApiKey: string;
  private readonly openaiClient: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(ILlmService) private readonly llmService: ILlmService,
  ) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY');
    this.xaiApiKey = this.configService.get<string>('XAI_API_KEY');
    
    // Initialize OpenAI client for Grok
    this.openaiClient = new OpenAI({
      apiKey: this.xaiApiKey || 'dummy-key',
      baseURL: 'https://api.x.ai/v1',
    });
    
    if (!this.googleApiKey && !this.xaiApiKey) {
      this.logger.warn('Neither GOOGLE_API_KEY nor XAI_API_KEY is configured. Langchain agent service will not work properly.');
    } else if (!this.googleApiKey) {
      this.logger.log('GOOGLE_API_KEY is not configured. Using XAI (Grok) as the default provider.');
    } else if (!this.xaiApiKey) {
      this.logger.warn('XAI_API_KEY is not configured. Using Google (Gemini) as the default provider.');
    } else {
      this.logger.log('Both GOOGLE_API_KEY and XAI_API_KEY are configured. Prioritizing XAI (Grok) as the default provider.');
    }
  }
  
  async checkConnection(): Promise<boolean> {
    try {
      // Try Grok first if available
      if (this.xaiApiKey) {
        try {
          await this.openaiClient.chat.completions.create({
            model: "grok-3-latest",
            messages: [
              { role: "user", content: "Hello" }
            ],
            max_tokens: 10
          });
          this.logger.log('Successfully connected to Grok API');
          return true;
        } catch (grokError) {
          this.logger.error(`Grok connection check failed: ${grokError.message}`);
          // Fall back to Gemini if available
        }
      }
      
      // Try Gemini if available
      if (this.googleApiKey) {
        const genAI = new GoogleGenerativeAI(this.googleApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        await model.generateContent('Hello');
        this.logger.log('Successfully connected to Gemini API');
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Connection check failed: ${error.message}`);
      return false;
    }
  }
  
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { input, config, sessionId } = request;
      const { assistantId, knowledgeBaseId } = config || {};
      
      if (!assistantId) {
        throw new Error('Assistant ID is required');
      }
      
      // Get the assistant
      const assistant = await this.prisma.assistant.findUnique({
        where: { id: assistantId }
      });
      
      if (!assistant) {
        throw new Error(`Assistant with ID ${assistantId} not found`);
      }
      
      // Extract model configuration from assistant
      const modelConfig = assistant.model as any || {};
      const provider = modelConfig.provider || (this.xaiApiKey ? 'xai' : 'google');
      let modelName = '';
      let modelUsed = '';
      
      // Get chat history
      const rawMessages = await this.getChatHistory(sessionId);
      
      // Get knowledge base results if needed
      let context = '';
      if (knowledgeBaseId) {
        const kbResults = await this.searchKnowledgeBase(knowledgeBaseId, input);
        if (kbResults.length > 0) {
          context = 'Here is some relevant information:\n\n' + 
            kbResults.map(result => result.payload?.text || '').join('\n\n');
        }
      }
      
      // Determine which provider to use based on available API keys
      // Prioritize using Grok if XAI_API_KEY is available
      if (this.xaiApiKey) {
        // Use Grok
        // Remove any provider prefix from the model name (e.g., 'x-ai/grok-2-1212' -> 'grok-2-1212')
        modelName = (modelConfig.model || 'grok-3-latest').replace(/^.*?\//g, '');
        modelUsed = modelName; // Don't prefix with provider for Grok API
        
        // Prepare messages for Grok
        const messages = [];
        
        // Add system prompt
        // Make sure we're using the voicemailMessage which contains the actual system instructions
        // NOT the firstMessage which contains the greeting
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
        // This prevents the greeting from appearing in every response
        if (systemPrompt.includes('Thank you for calling Wellness Partners')) {
          this.logger.warn('Found greeting text in system prompt, removing it');
          systemPrompt = systemPrompt.replace(/Thank you for calling Wellness Partners[^\n]*How may I help you today\?/g, '');
        }
        messages.push({
          role: 'system',
          content: systemPrompt
        });
        
        // Add context if available
        if (context) {
          messages.push({
            role: 'system',
            content: `Context information:\n${context}`
          });
        }
        
        // Add chat history, but filter out any greeting messages that match the assistant's firstMessage
        // This prevents the greeting from being passed to the LLM and causing repetition
        for (const message of rawMessages) {
          // Skip assistant messages that contain the standard greeting
          // This prevents the greeting from being included in the conversation history
          const isGreetingMessage = message.role === 'assistant' && 
            message.content.includes('Thank you for calling Wellness Partners') && 
            message.content.includes('How may I help you today');
            
          if (!isGreetingMessage) {
            messages.push({
              role: message.role,
              content: message.content
            });
          } else {
            this.logger.log('Skipping greeting message in chat history');
          }
        }
        
        // Add current query
        messages.push({
          role: 'user',
          content: input
        });
        
        // Generate response using Grok
        const completion = await this.openaiClient.chat.completions.create({
          model: modelName,
          messages: messages,
          temperature: modelConfig.temperature || 0.7,
          max_tokens: modelConfig.maxTokens || 2048
        });
        
        const responseText = completion.choices[0].message.content;
        
        return {
          output: responseText,
          sessionId,
          metadata: { 
            assistantId,
            knowledgeBaseId,
            modelUsed
          }
        };
      } else if (this.googleApiKey) {
        // Use Gemini
        modelName = 'gemini-1.5-pro';
        modelUsed = `google/${modelName}`;
        
        // Create the model with the assistant's configuration
        const genAI = new GoogleGenerativeAI(this.googleApiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: modelConfig.temperature || 0.7,
            maxOutputTokens: modelConfig.maxTokens || 2048,
          }
        });
        
        // Prepare messages for the model
        let prompt = '';
        
        // Add system prompt
        // Make sure we're using the voicemailMessage which contains the actual system instructions
        // NOT the firstMessage which contains the greeting
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
        // This prevents the greeting from appearing in every response
        if (systemPrompt.includes('Thank you for calling Wellness Partners')) {
          this.logger.warn('Found greeting text in system prompt, removing it');
          systemPrompt = systemPrompt.replace(/Thank you for calling Wellness Partners[^\n]*How may I help you today\?/g, '');
        }
        prompt += `${systemPrompt}\n\n`;
        
        // Add context if available
        if (context) {
          prompt += `Context information:\n${context}\n\n`;
        }
        
        // Add chat history
        for (const message of rawMessages) {
          if (message.role === 'user') {
            prompt += `User: ${message.content}\n`;
          } else {
            prompt += `Assistant: ${message.content}\n`;
          }
        }
        
        // Add current query
        prompt += `User: ${input}\nAssistant:`;
        
        // Generate response using the direct API
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        return {
          output: responseText,
          sessionId,
          metadata: { 
            assistantId,
            knowledgeBaseId,
            modelUsed
          }
        };
      } else {
        throw new Error('No valid API key configured for any provider');
      }
    } catch (error) {
      this.logger.error(`Error processing request: ${error.message}`);
      throw error;
    }
  }
  
  async *processStreamingRequest(request: AgentRequest): AsyncIterable<AgentResponse> {
    try {
      const { input, config, sessionId } = request;
      const { assistantId, knowledgeBaseId } = config || {};
      
      if (!assistantId) {
        throw new Error('Assistant ID is required');
      }
      
      // Get the assistant
      const assistant = await this.prisma.assistant.findUnique({
        where: { id: assistantId }
      });
      
      if (!assistant) {
        throw new Error(`Assistant with ID ${assistantId} not found`);
      }
      
      // Extract model configuration from assistant
      const modelConfig = assistant.model as any || {};
      // Prioritize using Grok if XAI_API_KEY is available, otherwise use the provider from the config
      const provider = this.xaiApiKey ? 'xai' : (modelConfig.provider || 'google');
      let modelName = '';
      let modelUsed = '';
      
      // Get chat history
      const rawMessages = await this.getChatHistory(sessionId);
      
      // Get knowledge base results if needed
      let context = '';
      if (knowledgeBaseId) {
        const kbResults = await this.searchKnowledgeBase(knowledgeBaseId, input);
        if (kbResults.length > 0) {
          context = 'Here is some relevant information:\n\n' + 
            kbResults.map(result => result.payload?.text || '').join('\n\n');
        }
      }
      
      // Determine which provider to use based on available API keys
      // Prioritize using Grok if XAI_API_KEY is available
      if (this.xaiApiKey) {
        // Use Grok
        // Remove any provider prefix from the model name (e.g., 'x-ai/grok-2-1212' -> 'grok-2-1212')
        modelName = (modelConfig.model || 'grok-3-latest').replace(/^.*?\//g, '');
        modelUsed = modelName; // Don't prefix with provider for Grok API
        
        // Prepare messages for Grok
        const messages = [];
        
        // Add system prompt
        // Make sure we're using the voicemailMessage which contains the actual system instructions
        // NOT the firstMessage which contains the greeting
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
        // This prevents the greeting from appearing in every response
        if (systemPrompt.includes('Thank you for calling Wellness Partners')) {
          this.logger.warn('Found greeting text in system prompt, removing it');
          systemPrompt = systemPrompt.replace(/Thank you for calling Wellness Partners[^\n]*How may I help you today\?/g, '');
        }
        messages.push({
          role: 'system',
          content: systemPrompt
        });
        
        // Add context if available
        if (context) {
          messages.push({
            role: 'system',
            content: `Context information:\n${context}`
          });
        }
        
        // Add chat history, but filter out any greeting messages that match the assistant's firstMessage
        // This prevents the greeting from being passed to the LLM and causing repetition
        for (const message of rawMessages) {
          // Skip assistant messages that contain the standard greeting
          // This prevents the greeting from being included in the conversation history
          const isGreetingMessage = message.role === 'assistant' && 
            message.content.includes('Thank you for calling Wellness Partners') && 
            message.content.includes('How may I help you today');
            
          if (!isGreetingMessage) {
            messages.push({
              role: message.role,
              content: message.content
            });
          } else {
            this.logger.log('Skipping greeting message in chat history');
          }
        }
        
        // Add current query
        messages.push({
          role: 'user',
          content: input
        });
        
        // Generate streaming response using Grok
        const stream = await this.openaiClient.chat.completions.create({
          model: modelName,
          messages: messages,
          temperature: modelConfig.temperature || 0.7,
          max_tokens: modelConfig.maxTokens || 2048,
          stream: true
        });
        
        let buffer = '';
        let hasContent = false;
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            buffer += content;
            hasContent = true;
            yield {
              output: content,
              sessionId,
              metadata: { 
                type: 'chunk',
                assistantId,
                knowledgeBaseId,
                modelUsed
              }
            };
          }
        }
        
        // Send a final metadata marker to signal completion
        // We send an empty string as output to avoid duplicating content
        // The client will still have the complete response from previous chunks
        yield {
          output: '', // Empty string to avoid duplicating content
          sessionId,
          metadata: { 
            type: 'final',
            assistantId,
            knowledgeBaseId,
            modelUsed
          }
        };
      } else if (this.googleApiKey) {
        // Use Gemini
        modelName = 'gemini-1.5-pro';
        modelUsed = `google/${modelName}`;
        
        // Create the model with the assistant's configuration
        const genAI = new GoogleGenerativeAI(this.googleApiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: modelConfig.temperature || 0.7,
            maxOutputTokens: modelConfig.maxTokens || 2048,
          }
        });
        
        // Prepare messages for the model
        let prompt = '';
        
        // Add system prompt
        // Make sure we're using the voicemailMessage which contains the actual system instructions
        // NOT the firstMessage which contains the greeting
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
        // This prevents the greeting from appearing in every response
        if (systemPrompt.includes('Thank you for calling Wellness Partners')) {
          this.logger.warn('Found greeting text in system prompt, removing it');
          systemPrompt = systemPrompt.replace(/Thank you for calling Wellness Partners[^\n]*How may I help you today\?/g, '');
        }
        prompt += `${systemPrompt}\n\n`;
        
        // Add context if available
        if (context) {
          prompt += `Context information:\n${context}\n\n`;
        }
        
        // Add chat history
        for (const message of rawMessages) {
          if (message.role === 'user') {
            prompt += `User: ${message.content}\n`;
          } else {
            prompt += `Assistant: ${message.content}\n`;
          }
        }
        
        // Add current query
        prompt += `User: ${input}\nAssistant:`;
        
        // Stream the response
        const streamResult = await model.generateContentStream(prompt);
        
        let buffer = '';
        for await (const chunk of streamResult.stream) {
          const chunkText = chunk.text();
          buffer += chunkText;
          
          yield {
            output: chunkText,
            sessionId,
            metadata: { 
              type: 'chunk',
              assistantId,
              knowledgeBaseId,
              modelUsed
            }
          };
        }
        
        // Final chunk with complete response
        yield {
          output: buffer,
          sessionId,
          metadata: { 
            type: 'final',
            assistantId,
            knowledgeBaseId,
            modelUsed
          }
        };
      } else {
        throw new Error('No valid API key configured for any provider');
      }
    } catch (error) {
      this.logger.error(`Error processing streaming request: ${error.message}`);
      throw error;
    }
  }
  
  private async getChatHistory(chatId: string) {
    if (!chatId) {
      return [];
    }
    
    try {
      const messages = await this.prisma.message.findMany({
        where: { chatId },
        orderBy: { sequenceId: 'asc' }
      });
      
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    } catch (error) {
      this.logger.error(`Error getting chat history: ${error.message}`);
      return [];
    }
  }
  
  private async searchKnowledgeBase(knowledgeBaseId: string, query: string) {
    if (!knowledgeBaseId || !query) {
      return [];
    }
    
    try {
      // Format the collection name according to the convention: kb_{knowledgeBaseId}
      const collectionName = `kb_${knowledgeBaseId}`;
      this.logger.log(`Searching knowledge base ${knowledgeBaseId} for: ${query}`);
      
      // First, get the knowledge base to check if it exists
      const knowledgeBase = await this.prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId }
      });
      
      if (!knowledgeBase) {
        this.logger.warn(`Knowledge base ${knowledgeBaseId} not found`);
        return [];
      }
      
      // For now, we'll retrieve the chunks directly from the database
      // In a production implementation, you would:
      // 1. Generate embeddings for the query using the same model as the knowledge base
      // 2. Perform a vector search in the vector database (e.g., Qdrant)
      // 3. Return the most semantically similar chunks
      
      // Get the most recent chunks for this knowledge base
      const chunks = await this.prisma.chunkMetadata.findMany({
        where: {
          knowledgeBaseId: knowledgeBaseId
        },
        take: 5,
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // Get the source information for these chunks
      const sourceIds = [...new Set(chunks.map(chunk => chunk.sourceId))];
      const sources = await this.prisma.knowledgeBaseSource.findMany({
        where: {
          id: { in: sourceIds }
        }
      });
      
      // Create a map of source information for quick lookup
      const sourceMap = sources.reduce((map, source) => {
        map[source.id] = {
          id: source.id,
          name: source.sourcePointer || 'Unknown', // Use sourcePointer as name
          type: source.sourceType || 'Unknown'
        };
        return map;
      }, {} as Record<string, { id: string; name: string; type: string }>);
      
      // Transform chunks to search results format
      const searchResults = chunks.map(chunk => {
        const source = sourceMap[chunk.sourceId];
        return {
          id: chunk.id,
          score: 0.9, // Placeholder score - in a real implementation, this would be the cosine similarity
          payload: {
            text: chunk.textPreview,
            metadata: {
              sourceId: chunk.sourceId,
              sourceName: source?.name || 'Unknown',
              sourceType: source?.type || 'Unknown',
              chunkIndex: chunk.chunkIndex
            }
          }
        };
      });
      
      this.logger.log(`Found ${searchResults.length} results from knowledge base`);
      return searchResults;
    } catch (error) {
      this.logger.error(`Error searching knowledge base: ${error.message}`);
      return [];
    }
  }
}
