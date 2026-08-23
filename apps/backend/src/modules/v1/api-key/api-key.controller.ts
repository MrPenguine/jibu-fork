import {
  Body, Controller, Delete, Get, Param, Post, Req, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { RevealApiKeyDto } from './dto/reveal-api-key.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../core/auth/guards/organization.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; workspaceId: string };
  apiKey?: unknown;
}

@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  createApiKey(@Body() body: CreateApiKeyDto, @Req() req: AuthenticatedRequest) {
    return this.apiKeyService.createApiKey(
      body, req.user.workspaceId, req.user.userId, this.requestHeaders(req),
    );
  }

  @Get()
  listApiKeys(@Req() req: AuthenticatedRequest) {
    return this.apiKeyService.listApiKeys(req.user.workspaceId);
  }

  @Get(':id')
  getApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apiKeyService.getApiKey(id, req.user.workspaceId);
  }

  @Post(':id/reveal')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  revealApiKey(
    @Param('id') id: string,
    @Body() body: RevealApiKeyDto | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.apiKeyService.revealApiKey(
      id, req.user.workspaceId, req.user.userId, body?.password, req,
    );
  }

  @Post(':id/rotate')
  rotateApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apiKeyService.rotateApiKey(
      id, req.user.workspaceId, req.user.userId, this.requestHeaders(req),
    );
  }

  @Post(':id/revoke')
  revokeApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apiKeyService.revokeApiKey(
      id, req.user.workspaceId, this.requestHeaders(req),
    );
  }

  @Delete(':id')
  deleteApiKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.apiKeyService.deleteApiKey(
      id, req.user.workspaceId, this.requestHeaders(req),
    );
  }

  private requestHeaders(req: Request): Headers {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    return headers;
  }
}
