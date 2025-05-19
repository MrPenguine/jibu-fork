import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAgentService, AgentRequest, AgentResponse } from '../../interfaces/agent.interface';
import { PrismaService } from '../../../../core/database/prisma.service';
import { XaiProvider } from './providers/xai-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { MistralProvider } from './providers/mistral-provider';
import { RagService } from './rag.service';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import OpenAI from 'openai';
import axios from 'axios';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LangchainAgentService implements IAgentService {
  private readonly logger = new Logger(LangchainAgentService.name);
  private readonly googleApiKey: string;
  private readonly xaiApiKey: string;
  private readonly mistralApiKey: string;
  private readonly openaiClient: OpenAI;
  private readonly workerApiUrl: string;
  
  // Provider instances
  private readonly xaiProvider: XaiProvider;
  private readonly geminiProvider: GeminiProvider;
  private readonly mistralProvider: MistralProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
  ) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY');
    this.xaiApiKey = this.configService.get<string>('XAI_API_KEY');
    this.mistralApiKey = this.configService.get<string>('MISTRAL_API_KEY');
    this.workerApiUrl = this.configService.get<string>('WORKER_API_URL') || 'http://localhost:3001';
    
    // Initialize OpenAI client for Grok
    this.openaiClient = new OpenAI({
      apiKey: this.xaiApiKey || 'dummy-key',
      baseURL: 'https://api.x.ai/v1',
    });
    
    // Initialize provider instances
    this.xaiProvider = new XaiProvider(this.xaiApiKey);
    this.geminiProvider = new GeminiProvider(this.googleApiKey);
    this.mistralProvider = new MistralProvider(this.mistralApiKey);
    
    if (!this.googleApiKey && !this.xaiApiKey && !this.mistralApiKey) {
      this.logger.warn('No API keys configured. Langchain agent service will not work properly.');
    } else {
      const providers = [];
      if (this.xaiApiKey) providers.push('XAI (Grok)');
      if (this.googleApiKey) providers.push('Google (Gemini)');
      if (this.mistralApiKey) providers.push('Mistral AI');
      this.logger.log(`Available providers: ${providers.join(', ')}`);
    }
  }
  
  /**
   * Determines the appropriate provider based on model configuration and available API keys
   */
  private determineProvider(modelConfig: any): { provider: string, modelName: string, modelUsed: string } {
    const configProvider = (modelConfig?.provider || '').toLowerCase();
    const configModel = (modelConfig?.model || '').toLowerCase();
    
    let provider = '';
    let modelName = '';
    
    // Determine provider based on configuration
    if (configProvider.includes('x-ai') || configProvider.includes('xai') || configProvider.includes('grok')) {
      if (this.xaiApiKey) {
        provider = 'xai';
        // Extract model name, removing any provider prefix
        modelName = configModel.replace(/^.*?\//, '');
        // Ensure it's a valid Grok model
        if (!modelName.includes('grok')) {
          modelName = 'grok-3-latest';
        }
      }
    } else if (configProvider.includes('google') || configProvider.includes('gemini')) {
      if (this.googleApiKey) {
        provider = 'google';
        // Extract model name, removing any provider prefix
        modelName = configModel.replace(/^.*?\//, '');
        // Ensure it's a valid Gemini model
        if (!modelName.includes('gemini')) {
          modelName = 'gemini-1.5-pro';
        }
      }
    } else if (configProvider.includes('mistral')) {
      if (this.mistralApiKey) {
        provider = 'mistral';
        // Extract model name, removing any provider prefix
        modelName = configModel.replace(/^.*?\//, '');
        // Ensure it's a valid Mistral model
        if (!modelName.includes('mistral')) {
          modelName = 'mistral-large-latest';
        }
      }
    } else if (configModel.includes('grok') && this.xaiApiKey) {
      provider = 'xai';
      modelName = configModel.replace(/^.*?\//, '');
    } else if (configModel.includes('gemini') && this.googleApiKey) {
      provider = 'google';
      modelName = configModel.replace(/^.*?\//, '');
    } else if (configModel.includes('mistral') && this.mistralApiKey) {
      provider = 'mistral';
      modelName = configModel.replace(/^.*?\//, '');
    } else {
      // Use first available provider
      if (this.xaiApiKey) {
        provider = 'xai';
        modelName = 'grok-3-latest';
      } else if (this.googleApiKey) {
        provider = 'google';
        modelName = 'gemini-1.5-pro';
      } else if (this.mistralApiKey) {
        provider = 'mistral';
        modelName = 'mistral-large-latest';
      }
    }
    
    // Construct full model identifier for logging
    let modelUsed = '';
    if (provider === 'xai') {
      modelUsed = `x-ai/${modelName}`;
    } else if (provider === 'google') {
      modelUsed = `google/${modelName}`;
    } else if (provider === 'mistral') {
      modelUsed = `mistral/${modelName}`;
    }
    
    this.logger.log(`Using provider: ${provider}, model: ${modelName}, full identifier: ${modelUsed}`);
    
    return { provider, modelName, modelUsed };
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
      
      // Extract model configuration from assistant and determine provider
      const modelConfig = assistant.model as any || {};
      const { provider, modelName, modelUsed } = this.determineProvider(modelConfig);
      
      if (!provider) {
        throw new Error('No valid API key configured for any provider');
      }
      
      // Get chat history
      const rawMessages = await this.getChatHistory(sessionId);
      
     // Get knowledge base results if needed
let context = '';
      // Use knowledgeBaseId from request config or from the assistant if not provided
      const effectiveKnowledgeBaseId = knowledgeBaseId || assistant.knowledgeBaseId;

      if (effectiveKnowledgeBaseId) {
        this.logger.log(`Using knowledge base ID: ${effectiveKnowledgeBaseId} for query`);
        const kbResults = await this.searchKnowledgeBase(effectiveKnowledgeBaseId, input);
        if (kbResults.length > 0) {
          this.logger.log(`Found ${kbResults.length} results from knowledge base`);
          context = 'Here is some relevant information:\n\n' + 
            kbResults.map(result => result.payload?.text || '').join('\n\n');
        } else {
          this.logger.warn(`No results found from knowledge base ${effectiveKnowledgeBaseId}`);
        }
      } else {
        this.logger.log('No knowledge base ID available for this assistant');
      }
      
      // Process request based on provider
      if (provider === 'xai') {
        // Use Grok
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
      } else if (provider === 'google') {
        // Use Gemini
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
          // Skip assistant messages that contain the standard greeting
          const isGreetingMessage = message.role === 'assistant' && 
            message.content.includes('Thank you for calling Wellness Partners') && 
            message.content.includes('How may I help you today');
            
          if (!isGreetingMessage) {
            prompt += `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}\n\n`;
          } else {
            this.logger.log('Skipping greeting message in chat history');
          }
        }
        
        // Add current query
        prompt += `User: ${input}\n\nAssistant: `;
        
        // Generate response
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
      } else if (provider === 'mistral') {
        // Use Mistral
        // Prepare messages for Mistral
        const messages = [];
        
        // Add system prompt
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
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
        
        // Add chat history
        for (const message of rawMessages) {
          // Skip assistant messages that contain the standard greeting
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
        
        // Generate response using Mistral API
        const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.mistralApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: modelConfig.temperature || 0.7,
            max_tokens: modelConfig.maxTokens || 2048
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Mistral API error: ${response.status} ${errorText}`);
        }
        
        const responseData = await response.json();
        const responseText = responseData.choices[0].message.content;
        
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
      
      // Extract model configuration from assistant and determine provider
      const modelConfig = assistant.model as any || {};
      const { provider, modelName, modelUsed } = this.determineProvider(modelConfig);
      
      if (!provider) {
        throw new Error('No valid API key configured for any provider');
      }
      
      // Get chat history
      const rawMessages = await this.getChatHistory(sessionId);
      
      // Get knowledge base results if needed
      let context = '';
      // Use knowledgeBaseId from request config or from the assistant if not provided
      const effectiveKnowledgeBaseId = knowledgeBaseId || assistant.knowledgeBaseId;

      if (effectiveKnowledgeBaseId) {
        this.logger.log(`Using knowledge base ID: ${effectiveKnowledgeBaseId} for streaming query`);
        const kbResults = await this.searchKnowledgeBase(effectiveKnowledgeBaseId, input);
        if (kbResults.length > 0) {
          this.logger.log(`Found ${kbResults.length} results from knowledge base for streaming request`);
          context = 'Here is some relevant information:\n\n' + 
            kbResults.map(result => result.payload?.text || '').join('\n\n');
        } else {
          this.logger.warn(`No results found from knowledge base ${effectiveKnowledgeBaseId} for streaming request`);
        }
      } else {
        this.logger.log('No knowledge base ID available for this assistant');
      }
      
      // Process streaming request based on provider
      if (provider === 'xai') {
        // Use Grok
        // Prepare messages for Grok
        const messages = [];
        
        // Add system prompt
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
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
        
        // Add chat history, but filter out any greeting messages
        for (const message of rawMessages) {
          // Skip assistant messages that contain the standard greeting
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
      } else if (provider === 'google') {
        // Use Gemini
        // Prepare system instructions
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
        if (systemPrompt.includes('Thank you for calling Wellness Partners')) {
          this.logger.warn('Found greeting text in system prompt, removing it');
          systemPrompt = systemPrompt.replace(/Thank you for calling Wellness Partners[^\n]*How may I help you today\?/g, '');
        }
        
        // Prepare chat history in the format expected by the Gemini API
        const chatHistory = [];
        
        // Add context as system message if available
        if (context) {
          chatHistory.push({
            role: 'user',
            parts: [{ text: 'Here is some relevant context information:' }]
          });
          chatHistory.push({
            role: 'model',
            parts: [{ text: context }]
          });
        }
        
        // Add chat history
        for (const message of rawMessages) {
          chatHistory.push({
            role: message.role === 'user' ? 'user' : 'model',
            parts: [{ text: message.content }]
          });
        }
        
        // Create the model with the assistant's configuration
        const genAI = new GoogleGenerativeAI(this.googleApiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: modelConfig.temperature || 0.7,
            maxOutputTokens: modelConfig.maxTokens || 2048,
          }
        });
        
        // Convert chat history to the format expected by the Gemini API
        const contents = [];
        
        // Add chat history
        for (const message of chatHistory) {
          contents.push(message);
        }
        
        // Add the current user message
        contents.push({
          role: 'user',
          parts: [{ text: input }]
        });
        
        // Stream the response
        const streamResult = await model.generateContentStream({
          contents,
          systemInstruction: systemPrompt
        });
        
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
          output: '',
          sessionId,
          metadata: { 
            type: 'final',
            assistantId,
            knowledgeBaseId,
            modelUsed
          }
        };
      } else if (provider === 'mistral') {
        // Use Mistral
        // Prepare messages for Mistral
        const messages = [];
        
        // Add system prompt
        let systemPrompt = assistant.voicemailMessage || 'You are a helpful assistant.';
        
        // Remove any greeting text that might have been included in the system prompt
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
        
        // Add chat history
        for (const message of rawMessages) {
          // Skip assistant messages that contain the standard greeting
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
        
        // Generate streaming response using Mistral API
        const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.mistralApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            stream: true,
            temperature: modelConfig.temperature || 0.7,
            max_tokens: modelConfig.maxTokens || 2048
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Mistral API error: ${response.status} ${errorText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                
                if (content) {
                  buffer += content;
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
              } catch (e) {
                this.logger.error(`Error parsing Mistral stream chunk: ${e.message}`);
              }
            }
          }
        }
        
        // Send a final metadata marker to signal completion
        yield {
          output: '',
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
      
      return messages.map(message => ({
        role: message.role,
        content: message.content
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
      // Use the knowledgeBase model to search
      const kb = await this.prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId }
      });
      
      if (!kb) {
        this.logger.warn(`Knowledge base with ID ${knowledgeBaseId} not found`);
        return [];
      }

      // Preprocess the query to improve search results
      const processedQuery = this.ragService.preprocessQuery(query);
      if (processedQuery !== query) {
        this.logger.log(`Preprocessed query from "${query}" to "${processedQuery}"`);
      }
      
      // Try multiple search attempts with different strategies if needed
      let results = [];
      
      // Use the RAG service to search the knowledge base
      this.logger.log(`Searching knowledge base ${knowledgeBaseId} for query: ${processedQuery}`);
      results = await this.ragService.searchKnowledgeBase(knowledgeBaseId, processedQuery);
      
      // If no results found and the query is about a category or classification
      if (results.length === 0 && 
          (query.toLowerCase().includes('category') || 
           query.toLowerCase().includes('which category') || 
           query.toLowerCase().includes('what type') || 
           query.toLowerCase().includes('classified as'))) {
        
        // Extract potential entity names using regex
        const entityMatch = query.match(/([A-Z][a-z]+(\s[A-Z][a-z]+)*)/g);
        if (entityMatch && entityMatch.length > 0) {
          const entityName = entityMatch[0];
          this.logger.log(`No results found. Trying again with extracted entity name: ${entityName}`);
          
          // Try searching with just the entity name
          results = await this.ragService.searchKnowledgeBase(knowledgeBaseId, entityName);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Error searching knowledge base: ${error.message}`);
      return [];
    }
  }
}
