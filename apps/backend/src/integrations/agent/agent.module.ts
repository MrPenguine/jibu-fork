import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentService } from './agent.service';
import { LangchainAgentService } from './providers/langchain/langchain-agent.service';
import { IAgentService } from './interfaces/agent.interface';
import { LangchainModule } from './providers/langchain/langchain.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RedisModule } from '../../core/redis/redis.module';
import { RagService } from './providers/langchain/rag.service';

@Module({
  imports: [ConfigModule, LangchainModule, DatabaseModule, RedisModule],
  providers: [
    LangchainAgentService,
    RagService,
    {
      provide: AgentService,
      useClass: LangchainAgentService
    },
    {
      provide: IAgentService,
      useExisting: AgentService
    }
  ],
  exports: [AgentService, IAgentService]
})
export class AgentModule {}
