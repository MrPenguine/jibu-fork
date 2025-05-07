import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as os from 'os';

async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Configure CPU threads based on available cores
  const numCPUs = os.cpus().length;
  const threads = Math.max(2, Math.min(numCPUs - 1, 4)); // Use between 2 and 4 threads
  
  // Set environment variable for Bull concurrency
  process.env.INDEXING_CONCURRENCY = String(threads);
  logger.log(`Starting worker with ${threads} threads for concurrent processing`);

  // Run the worker in background mode
  await app.listen(parseInt(process.env.WORKER_PORT || '3001', 10));
  logger.log(`Worker running on port ${process.env.WORKER_PORT || '3001'}`);
}

bootstrap(); 