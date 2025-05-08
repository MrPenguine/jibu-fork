import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Request,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AssistantService } from './assistant.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';
import axios from 'axios';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';

@ApiTags('assistants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistants')
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);
  private modelsCache: any = null;
  private modelsCacheTime: number = 0;
  private CACHE_TTL = 3600000; // 1 hour in milliseconds

  constructor(
    private readonly assistantService: AssistantService,
    @InjectQueue(QUEUE_NAMES.DEFAULT) private readonly defaultQueue: Queue,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new assistant' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'The assistant has been successfully created.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  async create(@Body() createAssistantDto: CreateAssistantDto, @Request() req) {
    this.logger.log(`Creating assistant for org ${createAssistantDto.organizationId}`);
    // Ensure the user has access to the organization
    const userId = req.user.sub || req.user.id;
    
    if (!createAssistantDto.organizationId) {
      throw new HttpException('Organization ID is required', HttpStatus.BAD_REQUEST);
    }
    
    return this.assistantService.create(createAssistantDto, userId);
  }

  @Get('models')
  @ApiOperation({ summary: 'Get available models from OpenRouter API' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns categorized models by provider.' })
  async getModels() {
    try {
      // Check if we have a valid in-memory cache
      const now = Date.now();
      if (this.modelsCache && (now - this.modelsCacheTime < this.CACHE_TTL)) {
        this.logger.log('Returning in-memory cached models');
        return this.modelsCache;
      }

      // Try to get from Redis cache
      try {
        const cachedData = await this.defaultQueue.client.get('openrouter_models_cache');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          const cacheAge = now - parsed.timestamp;
          
          if (cacheAge < this.CACHE_TTL) {
            this.logger.log('Returning models from Redis cache');
            // Update in-memory cache
            this.modelsCache = parsed.data;
            this.modelsCacheTime = parsed.timestamp;
            return parsed.data;
          } else {
            this.logger.log('Redis cache expired - fetching fresh data');
          }
        }
      } catch (redisError) {
        this.logger.error(`Redis cache retrieval error: ${redisError.message}`);
      }

      this.logger.log('Cache miss - fetching models from OpenRouter API');
      
      const response = await axios.get('https://openrouter.ai/api/v1/models', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const models = response.data.data;
      
      // Minimum context length requirement
      const MIN_CONTEXT_LENGTH = 8192;
      
      // List of deprecated or older models to filter out
      const DEPRECATED_MODELS = [
        'openai/gpt-3.5-turbo-0613',
        'openai/gpt-4-0314',
        'openai/gpt-4-1106-preview',
        'mistralai/mistral-tiny',
        'mistralai/mistral-7b-instruct-v0.1',
        'anthropic/claude-1',
        'anthropic/claude-2',
        'anthropic/claude-instant-1'
      ];
      
      // Known fast models for streaming
      const KNOWN_FAST_MODELS = [
        'groq/llama3-8b-8192',
        'groq/llama3-70b-8192',
        'groq/mixtral-8x7b-32768',
        'anthropic/claude-3-haiku',
        'google/gemini-flash-1.5',
        'google/gemini-2.0-flash-lite-001',
        'google/gemini-2.0-flash-001',
        'mistralai/mistral-small',
        'mistralai/ministral-8b',
        'openai/gpt-4o-mini'
      ];
      
      // Known balanced models (good performance/speed trade-off)
      const KNOWN_BALANCED_MODELS = [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'openai/gpt-3.5-turbo',
        'mistralai/mistral-large',
        'mistralai/mixtral-8x22b-instruct',
        'meta-llama/llama-3.1-8b-instruct',
        'meta-llama/llama-3.1-70b-instruct',
        'meta-llama/llama-3.3-70b-instruct',
        'cohere/command-r',
        'cohere/command-r-plus'
      ];
      
      // Filter and process models
      const filteredModels = models.filter(model => {
        const modelId = model.id.toLowerCase();
        
        // Skip deprecated models
        if (DEPRECATED_MODELS.some(deprecated => modelId === deprecated.toLowerCase())) {
          return false;
        }
        
        // Skip models with insufficient context length
        if (model.context_length < MIN_CONTEXT_LENGTH) {
          return false;
        }
        
        // Filter for chat/instruct models
        const isChatModel = 
          modelId.includes('instruct') || 
          modelId.includes('chat') || 
          modelId.includes('claude') ||
          modelId.includes('gpt') ||
          modelId.includes('gemini') ||
          modelId.includes('command') ||
          modelId.includes('llama') ||
          (model.description && (
            model.description.toLowerCase().includes('chat') || 
            model.description.toLowerCase().includes('instruct') ||
            model.description.toLowerCase().includes('conversation')
          ));
          
        return isChatModel;
      });
      
      // Categorize models by provider
      const categorizedModels = {
        openai: [],
        google: [],
        anthropic: [],
        mistralai: [],
        groq: [],
        meta: [],
        cohere: [],
        other: []
      };
      
      // Categorize filtered models by provider
      filteredModels.forEach(model => {
        const modelId = model.id.toLowerCase();
        const provider = modelId.split('/')[0];
        
        // Create standardized model info object
        const modelInfo = {
          id: model.id,
          name: model.name,
          contextLength: model.context_length,
          description: model.description || ''
        };
        
        // Add speed tier information
        let speedTier = 'standard';
        if (KNOWN_FAST_MODELS.some(id => model.id.includes(id))) {
          speedTier = 'fastest';
        } else if (KNOWN_BALANCED_MODELS.some(id => model.id.includes(id))) {
          speedTier = 'balanced';
        }
        
        // Categorize by provider
        switch(provider) {
          case 'openai':
            categorizedModels.openai.push(modelInfo);
            break;
          case 'google':
            categorizedModels.google.push(modelInfo);
            break;
          case 'anthropic':
            categorizedModels.anthropic.push(modelInfo);
            break;
          case 'mistralai':
            categorizedModels.mistralai.push(modelInfo);
            break;
          case 'groq':
            categorizedModels.groq.push(modelInfo);
            break;
          case 'meta':
          case 'meta-llama':
            categorizedModels.meta.push(modelInfo);
            break;
          case 'cohere':
            categorizedModels.cohere.push(modelInfo);
            break;
          default:
            categorizedModels.other.push(modelInfo);
        }
      });
      
      // Remove empty categories
      Object.keys(categorizedModels).forEach(key => {
        if (categorizedModels[key].length === 0) {
          delete categorizedModels[key];
        }
      });
      
      this.logger.log(`Filtered models: ${JSON.stringify(Object.keys(categorizedModels))}`);
      
      // Cache the results
      this.modelsCache = categorizedModels;
      this.modelsCacheTime = now;
      
      // Store in Redis for cross-instance caching
      await this.defaultQueue.client.set(
        'openrouter_models_cache',
        JSON.stringify({ data: categorizedModels, timestamp: now }),
        'EX',
        Math.floor(this.CACHE_TTL / 1000) // Convert to seconds for Redis
      );
      
      return categorizedModels;
    } catch (error) {
      this.logger.error(`Error fetching models: ${error.message}`);
      
      // Try to get from Redis if API call fails
      try {
        const cachedData = await this.defaultQueue.client.get('openrouter_models_cache');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          this.logger.log('Returning models from Redis cache after API failure');
          return parsed.data;
        }
      } catch (redisError) {
        this.logger.error(`Redis cache retrieval error: ${redisError.message}`);
      }
      
      throw new HttpException('Failed to fetch models', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all assistants for an organization' })
  @ApiQuery({ name: 'organizationId', required: true, description: 'ID of the organization' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns all assistants for the organization.' })
  async findAll(@Query('organizationId') organizationId: string, @Request() req) {
    this.logger.log(`Fetching assistants for org ${organizationId}`);
    if (!organizationId) {
      throw new HttpException('Organization ID is required', HttpStatus.BAD_REQUEST);
    }
    
    // Get user's ID from the request
    const userId = req.user.sub || req.user.id;
    
    return this.assistantService.findAllByOrganization(organizationId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an assistant by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the assistant.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Assistant not found.' })
  async findOne(@Param('id') id: string, @Request() req) {
    this.logger.log(`Fetching assistant ${id}`);
    const userId = req.user.sub || req.user.id;
    return this.assistantService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an assistant' })
  @ApiResponse({ status: HttpStatus.OK, description: 'The assistant has been successfully updated.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Assistant not found.' })
  async update(
    @Param('id') id: string,
    @Body() updateAssistantDto: UpdateAssistantDto,
    @Request() req
  ) {
    this.logger.log(`Updating assistant ${id}`);
    const userId = req.user.sub || req.user.id;
    return this.assistantService.update(id, updateAssistantDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an assistant' })
  @ApiResponse({ status: HttpStatus.OK, description: 'The assistant has been successfully deleted.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Assistant not found.' })
  async remove(@Param('id') id: string, @Request() req) {
    this.logger.log(`Deleting assistant ${id}`);
    const userId = req.user.sub || req.user.id;
    return this.assistantService.remove(id, userId);
  }
} 