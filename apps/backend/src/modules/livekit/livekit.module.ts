import { Module } from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import { LiveKitController } from './livekit.controller';

@Module({
  providers: [LiveKitService],
  controllers: [LiveKitController],
})
export class LiveKitModule {}
