import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// N8N
import { N8nIntegrationModule } from './n8n/n8n-integration.module';

// Storage
import { S3StorageService } from './storage/providers/s3/s3-storage.service';
import { storageServiceFactory } from './storage/storage.factory';
import { IStorageService } from './storage/interfaces/storage.interface';
import { StorageService } from './storage/storage.service';
import { StorageModule } from './storage/storage.module';

// Agent
import { AgentModule } from './agent/agent.module';
import { IAgentService } from './agent/interfaces/agent.interface';
import { AgentService } from './agent/agent.service';

// TTS
import { TtsModule } from './tts/tts.module';
import { ITtsService } from './tts/interfaces/tts.interface';
import { TtsService } from './tts/tts.service';

// STT
import { SttModule } from './stt/stt.module';
import { ISttService } from './stt/interfaces/stt.interface';
import { SttService } from './stt/stt.service';

// Service tokens
export const STT_SERVICE_TOKEN = 'STT_SERVICE_TOKEN';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    AgentModule,
    TtsModule,
    SttModule,
    N8nIntegrationModule,
  ],
  providers: [
    
    // Re-export the storage service interface
    {
      provide: IStorageService,
      useExisting: StorageService
    },
    // Re-export the agent service interface
    {
      provide: IAgentService,
      useExisting: AgentService
    },
    // Re-export the TTS service interface
    {
      provide: ITtsService,
      useExisting: TtsService
    },
    // Re-export the STT service interface
    {
      provide: STT_SERVICE_TOKEN,
      useExisting: SttService
    }
  ],
  exports: [
    // Export interface tokens for other modules to use

    IStorageService,
    IAgentService,
    ITtsService,
    STT_SERVICE_TOKEN,
    
    StorageModule,
    AgentModule,
    TtsModule,
    SttModule,
    N8nIntegrationModule,
  ],
})
export class IntegrationsModule {} 