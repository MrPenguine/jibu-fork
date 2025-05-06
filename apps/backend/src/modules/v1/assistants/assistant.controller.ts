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

@ApiTags('assistants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistants')
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);
  
  constructor(private readonly assistantService: AssistantService) {}

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