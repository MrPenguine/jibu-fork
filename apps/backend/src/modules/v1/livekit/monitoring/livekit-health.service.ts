import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: any;
  timestamp: number;
}

@Injectable()
export class LivekitHealthService {
  private readonly logger = new Logger(LivekitHealthService.name);
  private readonly livekitUrl: string;
  private lastHealthStatus: HealthStatus = {
    status: 'unhealthy',
    message: 'Health check not performed yet',
    timestamp: Date.now(),
  };

  constructor(private configService: ConfigService) {
    this.livekitUrl = this.configService.get<string>('LIVEKIT_URL');
    
    if (!this.livekitUrl) {
      this.logger.warn('LiveKit URL is not configured. Health checks will not work correctly.');
    } else {
      this.logger.log(`LivekitHealthService initialized with URL: ${this.livekitUrl}`);
      
      // Perform an initial health check
      this.checkHealth().catch(err => {
        this.logger.error(`Initial health check failed: ${err.message}`);
      });
    }
  }

  /**
   * Check the health of the LiveKit server
   * @returns Health status
   */
  async checkHealth(): Promise<HealthStatus> {
    if (!this.livekitUrl) {
      const status: HealthStatus = {
        status: 'unhealthy',
        message: 'LiveKit URL is not configured',
        timestamp: Date.now(),
      };
      this.lastHealthStatus = status;
      return status;
    }

    try {
      // Convert WebSocket URL to HTTP URL for health check
      const healthUrl = this.livekitUrl.replace('ws://', 'http://').replace('wss://', 'https://');
      
      // Perform a simple health check by requesting the root endpoint
      const response = await axios.get(`${healthUrl}/`, {
        timeout: 5000,
      });

      if (response.status === 200) {
        const status: HealthStatus = {
          status: 'healthy',
          message: 'LiveKit server is responding',
          details: {
            responseTime: response.headers['x-response-time'] || 'unknown',
          },
          timestamp: Date.now(),
        };
        this.lastHealthStatus = status;
        return status;
      } else {
        const status: HealthStatus = {
          status: 'degraded',
          message: `LiveKit server responded with status ${response.status}`,
          details: {
            statusCode: response.status,
            statusText: response.statusText,
          },
          timestamp: Date.now(),
        };
        this.lastHealthStatus = status;
        return status;
      }
    } catch (error) {
      const status: HealthStatus = {
        status: 'unhealthy',
        message: `Failed to connect to LiveKit server: ${error.message}`,
        details: {
          error: error.message,
          code: error.code,
        },
        timestamp: Date.now(),
      };
      this.lastHealthStatus = status;
      return status;
    }
  }

  /**
   * Get the last known health status
   * @returns Last health status
   */
  getLastHealthStatus(): HealthStatus {
    return this.lastHealthStatus;
  }

  /**
   * Check if the LiveKit server is healthy
   * @returns Boolean indicating if the server is healthy
   */
  async isHealthy(): Promise<boolean> {
    const status = await this.checkHealth();
    return status.status === 'healthy';
  }
}
