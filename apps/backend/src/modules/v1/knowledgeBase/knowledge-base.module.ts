import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { DatabaseModule } from '../../../core/database/database.module';
import { QueueModule } from '../../../core/queue/queue.module';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    FileModule, // Needed for file validation
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {} 