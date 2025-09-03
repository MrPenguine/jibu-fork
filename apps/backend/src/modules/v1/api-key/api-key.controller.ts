import { Controller, Post, Get, Delete, Body, Param, UsePipes, ValidationPipe, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    workspaceId: string;
  };
}

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'The API key has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createApiKey(@Body() body: CreateApiKeyDto, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.apiKeyService.createApiKey(body, workspaceId, userId);
  }

    @Get()
  @ApiOperation({ summary: 'List all API keys for the organization' })
  @ApiResponse({ status: 200, description: 'A list of API keys.' })
  async listApiKeys(@Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.apiKeyService.listApiKeys(workspaceId, userId);
  }

    @Get(':id')
  @ApiOperation({ summary: 'Get a specific API key' })
  @ApiResponse({ status: 200, description: 'The API key.' })
  @ApiResponse({ status: 404, description: 'API key not found.' })
  async getApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.apiKeyService.getApiKey(id, workspaceId, userId);
  }

    @Delete(':id')
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiResponse({ status: 200, description: 'The API key has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'API key not found.' })
  async deleteApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.apiKeyService.deleteApiKey(id, workspaceId, userId);
  }

    @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'The API key has been successfully revoked.' })
  @ApiResponse({ status: 404, description: 'API key not found.' })
  async revokeApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.apiKeyService.revokeApiKey(id, workspaceId, userId);
  }
} 