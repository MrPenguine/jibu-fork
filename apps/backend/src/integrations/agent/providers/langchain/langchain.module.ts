import { Module } from '@nestjs/common';
import { LangchainAgentService } from './langchain-agent.service';
import { RagService } from './rag.service';
import { DatabaseModule } from '../../../../core/database/database.module';
import { RedisModule } from '../../../../core/redis/redis.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    RedisModule
  ],
  providers: [
    LangchainAgentService,
    RagService
  ],
  exports: [
    LangchainAgentService
  ]
})
export class LangchainModule {}
