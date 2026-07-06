import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service';
import { StrategyChunkingService } from './strategy-chunking.service';

@Module({
  providers: [ChunkingService, StrategyChunkingService],
  exports: [ChunkingService, StrategyChunkingService],
})
export class ChunkingModule {}
