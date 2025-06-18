import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env file found');
  dotenv.config();
}

// Create a simple config service
const configService = {
  get: (key: string, defaultValue?: string) => process.env[key] || defaultValue,
};

// Check Redis configuration
const redisHost = configService.get('REDIS_HOST', 'localhost');
const redisPort = configService.get('REDIS_PORT', '6379');
const redisPassword = configService.get('REDIS_PASSWORD', '');

console.log('Redis Configuration:');
console.log(`REDIS_HOST: ${redisHost}`);
console.log(`REDIS_PORT: ${redisPort}`);
console.log(`REDIS_PASSWORD: ${redisPassword ? '******' : 'not set'}`);

// Check if Redis is running
const checkRedis = async () => {
  try {
    const Redis = require('ioredis');
    
    const options = {
      host: redisHost,
      port: parseInt(redisPort),
      password: redisPassword || undefined,
      retryStrategy: (times: number) => {
        // Try to reconnect after 1 second, but only once for this check
        return times < 1 ? 1000 : null;
      },
    };
    
    console.log(`Connecting to Redis at ${redisHost}:${redisPort}...`);
    const redis = new Redis(options);
    
    redis.on('error', (error: Error) => {
      console.error(`Redis connection error: ${error.message}`);
      redis.disconnect();
    });
    
    redis.on('connect', async () => {
      console.log('Redis is running!');
      
      // Test basic Redis operations
      try {
        // Set a test key
        await redis.set('test:connection', 'success');
        console.log('Successfully set test key');
        
        // Get the test key
        const value = await redis.get('test:connection');
        console.log(`Successfully retrieved test key: ${value}`);
        
        // Delete the test key
        await redis.del('test:connection');
        console.log('Successfully deleted test key');
        
        console.log('Redis is working correctly!');
      } catch (error) {
        console.error(`Redis operation error: ${error.message}`);
      } finally {
        redis.disconnect();
      }
    });
  } catch (error) {
    console.error('Error checking Redis:', error.message);
  }
};

checkRedis();
