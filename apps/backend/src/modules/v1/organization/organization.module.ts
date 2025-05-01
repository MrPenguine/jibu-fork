import { Module } from '@nestjs/common';
import { OrganizationController, InvitationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../../../core/database/prisma.service';

@Module({
  controllers: [OrganizationController, InvitationController],
  providers: [OrganizationService, PrismaService],
  exports: [OrganizationService]
})
export class OrganizationModule {} 