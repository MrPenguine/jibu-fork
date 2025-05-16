import { Module } from '@nestjs/common';
import { LangchainAgentService } from './langchain-agent.service';
import { DatabaseModule } from '../../../../core/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { GeminiLlmModule } from '../../../llm/providers/gemini/gemini-llm.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    GeminiLlmModule
  ],
  providers: [
    LangchainAgentService
  ],
  exports: [
    LangchainAgentService
  ]
})
export class LangchainModule {}
