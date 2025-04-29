import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { json } from 'express';

async function bootstrap() {
  // Create app WITHOUT built-in body parser
  const app = await NestFactory.create(AppModule, { 
    bodyParser: false // Disable NestJS built-in body parser
  });
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Use Express body parser with rawBody option
  app.use(json({
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