import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TtsService } from './tts.service';
import { ITtsService } from './interfaces/tts.interface';
import { ttsServiceFactory } from './tts.factory';

// Create providers directory structure
import { ElevenLabsTtsService } from './providers/elevenlabs/elevenlabs-tts.service';

@Module({
  imports: [ConfigModule],
  providers: [
    ElevenLabsTtsService,
    {
      provide: TtsService,
      useFactory: ttsServiceFactory,
      inject: [ConfigService, ElevenLabsTtsService],
    },
    {
      provide: ITtsService,
      useExisting: TtsService,
    },
  ],
  exports: [TtsService, ITtsService],
})
export class TtsModule {}
