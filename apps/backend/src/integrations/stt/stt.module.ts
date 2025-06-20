import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SttService } from './stt.service';
import { SttFactory } from './stt.factory';
import { AzureSttService } from './providers/azure/azure-stt.service';

@Module({
  imports: [ConfigModule],
  providers: [SttService, SttFactory, AzureSttService],
  exports: [SttService],
})
export class SttModule {}
