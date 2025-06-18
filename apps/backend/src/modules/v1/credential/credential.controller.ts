import { Controller, Post, Get, Delete, Body, Param, UsePipes, ValidationPipe, Req, UseGuards, Patch } from '@nestjs/common';
import { CredentialService } from './credential.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    orgId: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createCredential(@Body() body: CreateCredentialDto, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.credentialService.createCredential(body, orgId, userId);
  }

  @Get()
  async listCredentials(@Req() req: AuthenticatedRequest) {
    const { orgId } = req.user;
    return this.credentialService.listCredentials(orgId);
  }

  @Get(':id')
  async getCredential(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.credentialService.getCredential(id, orgId, userId);
  }

  @Delete(':id')
  async deleteCredential(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { orgId, userId } = req.user;
    return this.credentialService.deleteCredential(id, orgId, userId);
  }

  @Patch(':id')
  async updateCredential(
    @Param('id') id: string,
    @Body() body: { name?: string; type?: string },
    @Req() req: AuthenticatedRequest
  ) {
    const { orgId, userId } = req.user;
    return this.credentialService.updateCredential(id, orgId, userId, body);
  }
} 