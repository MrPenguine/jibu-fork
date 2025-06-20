import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISttService } from './interfaces/stt.interface';
import { AzureSttService } from './providers/azure/azure-stt.service';

/**
 * Factory for creating STT service instances
 */
@Injectable()
export class SttFactory {
  private readonly logger = new Logger(SttFactory.name);

  constructor(
    private configService: ConfigService,
    private azureSttService: AzureSttService,
  ) {}

  /**
   * Create an STT service instance based on configuration
   * @returns STT service instance
   */
  createSttService(): ISttService {
    const provider = this.configService.get<string>('STT_PROVIDER') || 'azure';
    
    this.logger.log(`Creating STT service with provider: ${provider}`);
    
    switch (provider.toLowerCase()) {
      case 'azure':
        return this.azureSttService;
      default:
        this.logger.warn(`Unknown STT provider: ${provider}, falling back to Azure`);
        return this.azureSttService;
    }
  }
}
