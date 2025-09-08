import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CompileContextBuilder } from './compile-context.builder';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [PrismaModule],
  providers: [CompileContextBuilder, OrchestratorService],
  exports: [CompileContextBuilder, OrchestratorService],
})
export class N8nOrchestratorModule {}
