import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@jibu/queue-definitions';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { DeadLetterService } from './dead-letter/dead-letter.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.WORKFLOW_EXECUTION,
    }),
  ],
  providers: [CircuitBreakerService, DeadLetterService],
  exports: [CircuitBreakerService, DeadLetterService],
})
export class CommonModule {}
