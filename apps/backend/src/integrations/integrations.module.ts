import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    AgentModule,
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
    }
  ],
  exports: [
    // Export interface tokens for other modules to use

    IStorageService,
    IAgentService,
    
    StorageModule,
    AgentModule,
  ],
})
export class IntegrationsModule {} 