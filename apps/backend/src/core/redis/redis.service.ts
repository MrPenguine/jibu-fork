import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initRedisClient();
  }

  onModuleDestroy() {
    this.disconnect();
  }

  private initRedisClient() {
    try {
      const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const port = this.configService.get<number>('REDIS_PORT') || 6379;
      const password = this.configService.get<string>('REDIS_PASSWORD');
      
      const options: RedisOptions = {
        host,
        port,
        password: password || undefined,
        retryStrategy: (times) => {
          // Try to reconnect after 3 seconds
          return Math.min(times * 500, 3000);
        },
      };

      this.redisClient = new Redis(options);

      this.redisClient.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      this.redisClient.on('connect', () => {
        console.log(`Connected to Redis at ${host}:${port}`);
      });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
    }
  }

  /**
   * Get a value from Redis by key
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      console.error(`Error getting value for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis with optional expiration time
   */
  async set(key: string, value: string, expirySeconds?: number): Promise<boolean> {
    try {
      if (expirySeconds) {
        await this.redisClient.set(key, value, 'EX', expirySeconds);
      } else {
        await this.redisClient.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Error setting value for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<boolean> {
    try {
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if a key exists in Redis
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Error checking existence for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set a hash field in Redis
   */
  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.redisClient.hset(key, field, value);
      return true;
    } catch (error) {
      console.error(`Error setting hash field ${field} for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get a hash field from Redis
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redisClient.hget(key, field);
    } catch (error) {
      console.error(`Error getting hash field ${field} for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get all fields and values from a hash in Redis
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redisClient.hgetall(key);
    } catch (error) {
      console.error(`Error getting all hash fields for key ${key}:`, error);
      return {};
    }
  }

  /**
   * Disconnect from Redis
   */
  disconnect() {
    if (this.redisClient) {
      this.redisClient.disconnect();
      console.log('Disconnected from Redis');
    }
  }
} 