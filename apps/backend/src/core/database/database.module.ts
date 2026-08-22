import { Module } from '@nestjs/common';
import { PrismaService, getSharedPrismaService } from './prisma.service';

@Module({
  providers: [{ provide: PrismaService, useFactory: getSharedPrismaService }],
  exports: [PrismaService],
})
export class DatabaseModule {} 