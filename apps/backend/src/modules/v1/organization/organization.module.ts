import { Module } from '@nestjs/common';
import { OrganizationController, InvitationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { ApiKeyModule } from '../api-key/api-key.module';
import { EncryptionModule } from '../../../core/encryption/encryption.module';

@Module({
  imports: [ApiKeyModule, EncryptionModule],
  controllers: [OrganizationController, InvitationController],
  providers: [OrganizationService, PrismaService],
  exports: [OrganizationService]
})
export class OrganizationModule {} 