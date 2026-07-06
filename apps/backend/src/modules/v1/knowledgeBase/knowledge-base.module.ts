import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { DatabaseModule } from '../../../core/database/database.module';
import { QueueModule } from '../../../core/queue/queue.module';
import { FileModule } from '../file/file.module';
import { AgentRuntimeModule } from '../../../integrations/agent/agent-runtime.module';
import { VectorDbService } from '../../../../../worker/src/vector-db/vector-db.service';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    FileModule, // Needed for file validation
    AgentRuntimeModule, // Provides RagService for the retrieval test endpoint
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, VectorDbService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {} 