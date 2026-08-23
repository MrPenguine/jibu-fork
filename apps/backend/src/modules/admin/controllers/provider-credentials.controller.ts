import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../../core/auth/guards/admin.guard';
import { AdminProviderCredentialsService } from '../services/provider-credentials.service';

class SetProviderCredentialDto {
  @IsString()
  @IsNotEmpty()
  secret!: string;
}

@ApiTags('Admin Provider Credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/provider-credentials')
export class AdminProviderCredentialsController {
  constructor(private readonly credentialsService: AdminProviderCredentialsService) {}

  @Get()
  list() {
    return this.credentialsService.list();
  }

  @Put(':provider')
  set(@Param('provider') provider: string, @Body() body: SetProviderCredentialDto, @Req() req: any) {
    return this.credentialsService.set(provider, body, req.user?.id as string);
  }

  @Delete(':provider')
  remove(@Param('provider') provider: string) {
    return this.credentialsService.remove(provider);
  }

  @Post(':provider/test')
  test(@Param('provider') provider: string, @Req() req: any) {
    return this.credentialsService.test(provider, req.user?.id as string);
  }
}
