import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { ScalingService } from './scaling.service';
import { N8nModule } from '../n8n/n8n.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: QUEUE_NAMES.WORKFLOW_EXECUTION,
    }),
    N8nModule,
  ],
  providers: [ScalingService],
  exports: [ScalingService],
})
export class ScalingModule {}
