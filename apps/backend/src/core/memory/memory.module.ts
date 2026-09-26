import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemoryService } from './memory.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
