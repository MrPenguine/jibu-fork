import { Controller, Post, Get, Delete, Body, Param, UsePipes, ValidationPipe, Req, UseGuards, Patch } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    orgId: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createApiKey(@Body() body: CreateApiKeyDto, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.apiKeyService.createApiKey(body, orgId, userId);
  }

  @Get()
  async listApiKeys(@Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.apiKeyService.listApiKeys(orgId, userId);
  }

  @Get(':id')
  async getApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.apiKeyService.getApiKey(id, orgId, userId);
  }

  @Delete(':id')
  async deleteApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.apiKeyService.deleteApiKey(id, orgId, userId);
  }

  @Post(':id/revoke')
  async revokeApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.apiKeyService.revokeApiKey(id, orgId, userId);
  }
} 