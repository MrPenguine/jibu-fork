import { Module } from '@nestjs/common';
import { LangchainAgentService } from './langchain-agent.service';
import { DatabaseModule } from '../../../../core/database/database.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule
  ],
  providers: [
    LangchainAgentService
  ],
  exports: [
    LangchainAgentService
  ]
})
export class LangchainModule {}
