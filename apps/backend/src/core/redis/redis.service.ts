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

  async ping(): Promise<boolean> {
    try {
      return (await this.redisClient.ping()) === 'PONG';
    } catch (error) {
      console.error('Error pinging Redis:', error);
      return false;
    }
  }

  async publish(channel: string, message: string): Promise<boolean> {
    try {
      await this.redisClient.publish(channel, message);
      return true;
    } catch (error) {
      console.error(`Error publishing to Redis channel ${channel}:`, error);
      return false;
    }
  }

  duplicate() {
    return this.redisClient.duplicate();
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
   * Count the fields in a Redis hash
   */
  async hlen(key: string): Promise<number> {
    try {
      return await this.redisClient.hlen(key);
    } catch (error) {
      console.error(`Error counting hash fields for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Delete one or more hash fields from Redis
   */
  async hdel(key: string, field: string): Promise<boolean> {
    try {
      await this.redisClient.hdel(key, field);
      return true;
    } catch (error) {
      console.error(`Error deleting hash field ${field} for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Run a Lua script atomically. Use this instead of a read-then-write pair
   * (get/set, hgetall/hset, etc.) whenever two concurrent callers checking
   * the same condition before writing would be a race — a Lua script runs
   * as a single atomic Redis operation, no other command can interleave.
   */
  async evalScript<T = unknown>(script: string, keys: string[], args: string[]): Promise<T> {
    return this.redisClient.eval(script, keys.length, ...keys, ...args) as Promise<T>;
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