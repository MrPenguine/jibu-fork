import { Module } from '@nestjs/common';
import { VoicesController } from './voices.controller';
import { VoicesService } from './voices.service';
import { IntegrationsModule } from '../../../integrations/integrations.module';
import { ITtsService } from '../../../integrations/tts/interfaces/tts.interface';
import { TtsService } from '../../../integrations/tts/tts.service';
import { RedisModule } from '../../../core/redis/redis.module';

@Module({
  imports: [IntegrationsModule, RedisModule],
  controllers: [VoicesController],
  providers: [VoicesService],
  exports: [VoicesService],
})
export class VoicesModule {}
