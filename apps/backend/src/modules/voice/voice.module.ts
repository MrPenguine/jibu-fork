import { Module } from '@nestjs/common';
import { TwilioController } from './twilio.controller';
import { VoiceService } from './voice.service';
import { QueueModule } from '../../core/queue/queue.module';
import { ServicesModule } from '../../core/services/services.module';

@Module({
  imports: [QueueModule, ServicesModule],
  controllers: [TwilioController],
  providers: [VoiceService],
})
export class VoiceModule {}
