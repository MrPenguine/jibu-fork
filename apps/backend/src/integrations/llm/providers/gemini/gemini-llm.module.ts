import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiLlmService } from './gemini-llm.service';
import { ILlmService } from '../../interfaces/llm.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    GeminiLlmService,
    {
      provide: ILlmService,
      useClass: GeminiLlmService,
    },
  ],
  exports: [GeminiLlmService, ILlmService],
})
export class GeminiLlmModule {}
