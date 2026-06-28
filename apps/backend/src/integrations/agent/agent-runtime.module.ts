import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../core/database/prisma.module';
import { RedisModule } from '../../core/redis/redis.module';
import { CredentialModule } from '../../modules/v1/credential/credential.module';
import { RagService } from './providers/langchain/rag.service';
import { ToolExecutorService } from './tool-executor.service';
import { AgentRuntimeService } from './agent-runtime.service';

/**
 * Bundles the single-brain runtime so any channel module (chat, whatsapp, voice)
 * can import it and call `AgentRuntimeService.runTurn` with one line of wiring.
 */
@Module({
  imports: [PrismaModule, HttpModule, RedisModule, CredentialModule],
  providers: [RagService, ToolExecutorService, AgentRuntimeService],
  exports: [AgentRuntimeService, ToolExecutorService, RagService],
})
export class AgentRuntimeModule {}
