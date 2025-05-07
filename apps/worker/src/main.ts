import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting worker service...');
  
  const app = await NestFactory.create(AppModule);
  
  // No need to listen on a port since this is a worker service
  await app.init();
  
  logger.log('Worker service initialized and ready to process jobs');
  logger.log('Worker is now connected to Redis and listening for knowledge base indexing tasks');
}

bootstrap().catch(err => {
  console.error('Failed to start worker service:', err);
  process.exit(1);
}); 