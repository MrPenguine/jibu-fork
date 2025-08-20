import { Controller, Post, Get, Delete, Body, Param, UsePipes, ValidationPipe, Req, UseGuards, Patch } from '@nestjs/common';
import { CredentialService } from './credential.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    workspaceId: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createCredential(@Body() body: CreateCredentialDto, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.credentialService.createCredential(body, workspaceId, userId);
  }

  @Get()
  async listCredentials(@Req() req: AuthenticatedRequest) {
    const { workspaceId } = req.user;
    return this.credentialService.listCredentials(workspaceId);
  }

  @Get(':id')
  async getCredential(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.credentialService.getCredential(id, workspaceId, userId);
  }

  @Delete(':id')
  async deleteCredential(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { workspaceId, userId } = req.user;
    return this.credentialService.deleteCredential(id, workspaceId, userId);
  }

  @Patch(':id')
  async updateCredential(
    @Param('id') id: string,
    @Body() body: { name?: string; type?: string },
    @Req() req: AuthenticatedRequest
  ) {
    const { workspaceId, userId } = req.user;
    return this.credentialService.updateCredential(id, workspaceId, userId, body);
  }
}