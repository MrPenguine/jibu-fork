import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service for managing n8n configuration and API keys
 * Centralizes access to environment variables and provides validation
 */
@Injectable()
export class N8nConfigService {
  private readonly logger = new Logger(N8nConfigService.name);
  
  // Required environment variables
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookBaseUrl: string;
  
  // Optional environment variables with defaults
  private readonly cacheTtl: number;
  
  constructor(private readonly configService: ConfigService) {
    // Get required configuration
    this.baseUrl = this.getRequiredConfig('N8N_BASE_URL');
    this.apiKey = this.getRequiredConfig('N8N_API_KEY');
    this.webhookBaseUrl = this.getRequiredConfig('N8N_WEBHOOK_BASE_URL');
    
    // Get optional configuration with defaults
    this.cacheTtl = this.getOptionalConfig('N8N_CACHE_TTL', 3600); // Default: 1 hour
    
    this.validateConfig();
  }
  
  /**
   * Get the n8n API base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
  
  /**
   * Get the n8n API key
   */
  getApiKey(): string {
    return this.apiKey;
  }
  
  /**
   * Get the base URL for webhook callbacks
   */
  getWebhookBaseUrl(): string {
    return this.webhookBaseUrl;
  }
  
  /**
   * Get the cache TTL in seconds
   */
  getCacheTtl(): number {
    return this.cacheTtl;
  }
  
  /**
   * Get HTTP headers for n8n API requests
   */
  getApiHeaders(): Record<string, string> {
    return {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
    };
  }
  
  /**
   * Get a required configuration value
   * @param key The environment variable key
   * @returns The configuration value
   * @throws Error if the configuration value is missing
   */
  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    
    if (!value) {
      this.logger.error(`Missing required environment variable: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
    
    return value;
  }
  
  /**
   * Get an optional configuration value with a default
   * @param key The environment variable key
   * @param defaultValue The default value if not set
   * @returns The configuration value or default
   */
  private getOptionalConfig<T>(key: string, defaultValue: T): T {
    const value = this.configService.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }
  
  /**
   * Validate the configuration
   * @throws Error if the configuration is invalid
   */
  private validateConfig(): void {
    // Validate base URL format
    try {
      new URL(this.baseUrl);
    } catch (error) {
      this.logger.error(`Invalid N8N_BASE_URL: ${this.baseUrl}`);
      throw new Error(`Invalid N8N_BASE_URL: ${this.baseUrl}`);
    }
    
    // Validate webhook base URL format
    try {
      new URL(this.webhookBaseUrl);
    } catch (error) {
      this.logger.error(`Invalid N8N_WEBHOOK_BASE_URL: ${this.webhookBaseUrl}`);
      throw new Error(`Invalid N8N_WEBHOOK_BASE_URL: ${this.webhookBaseUrl}`);
    }
    
    // Validate API key is not empty
    if (!this.apiKey.trim()) {
      this.logger.error('N8N_API_KEY is empty');
      throw new Error('N8N_API_KEY is empty');
    }
    
    this.logger.log('N8n configuration validated successfully');
  }
}
