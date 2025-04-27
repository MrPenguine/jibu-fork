/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Configure body parser to keep raw body
  // This MUST come before other middleware that might parse the body
  app.use(require('express').json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));
  
  // Enable CORS for the frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  });
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
