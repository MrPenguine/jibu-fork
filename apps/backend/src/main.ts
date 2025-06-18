import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { json } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Set NODE_ENV to development if not set
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  
  // Log the current environment
  console.log(`Starting application in ${process.env.NODE_ENV} mode`);
  
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
    },
    limit: '10mb', // Increase the size limit for file uploads
  }));
  
  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  
  // Enable CORS for the frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  });
  
  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Jibu API')
    .setDescription('API documentation for Jibu Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `📚 Swagger documentation available at: http://localhost:${port}/${globalPrefix}/docs`
  );
}

bootstrap();