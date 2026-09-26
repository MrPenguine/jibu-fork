import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { json } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { auth } from './core/auth/auth';
import helmet from 'helmet';

// Polyfill global crypto.randomUUID for @nestjs/schedule which expects a global crypto object
const g: any = global as any;

if (!('crypto' in g)) {
  g.crypto = {};
}

if (!g.crypto.randomUUID) {
  g.crypto.randomUUID = randomUUID;
}

async function bootstrap() {
  // Set NODE_ENV to development if not set
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  
  // Log the current environment
  console.log(`Starting application in ${process.env.NODE_ENV} mode`);
  
  // Create app WITHOUT built-in body parser
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'development' ? ['log', 'fatal', 'error', 'warn', 'debug', 'verbose'] : ['log', 'fatal', 'error', 'warn'],
    bodyParser: false // Disable NestJS built-in body parser
  });

  // helmet() sets standard security headers (X-Frame-Options, X-Content-Type-
  // Options, etc). CSP is disabled: this is an API-only backend, and the one
  // HTML surface it serves (Swagger UI, dev-only below) needs inline scripts
  // that a default CSP would block.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Enable CORS for every origin the app is actually served from — the
  // primary FRONTEND_URL plus any comma-separated extras (a tunnel domain
  // like ngrok, a staging domain, ...). Registered BEFORE the /api/auth
  // middleware below: that handler responds directly without calling next(),
  // so if CORS were registered after it, /api/auth requests would never get
  // CORS headers or preflight handling at all.
  const trustedOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.ADDITIONAL_TRUSTED_ORIGINS?.split(',') ?? []),
  ]
    .map((o) => o?.trim())
    .filter((o): o is string => Boolean(o));
  if (trustedOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FRONTEND_URL or ADDITIONAL_TRUSTED_ORIGINS must be set in production — refusing to fall back to an open CORS policy.',
      );
    }
    // Local dev convenience only — never reached in production (see above).
    trustedOrigins.push('http://localhost:3000');
  }
  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
  });

  app.use('/api/auth', async (req: any, res: any, next: any) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
      let body: Buffer | undefined;
      if (!['GET', 'HEAD'].includes(req.method)) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        body = Buffer.concat(chunks);
      }
      const request = new Request(`http://${req.headers.host}${req.originalUrl}`, {
        method: req.method,
        headers,
        body: body?.length ? (body as any) : undefined,
      });
      const response = await auth.handler(request);
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') res.setHeader(key, value);
      });
      const setCookies = response.headers.getSetCookie?.();
      if (setCookies?.length) res.setHeader('set-cookie', setCookies);
      res.send(await response.text());
    } catch (error) {
      next(error);
    }
  });
  app.use(json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
    limit: '10mb',
  }));

  // There was previously no request-level logging at all, so a guard
  // rejecting a request (401/403 — Nest doesn't log those by default) was
  // indistinguishable from the request never reaching the server. This
  // makes that visible without needing a full logging library.
  const httpLogger = new Logger('HTTP');
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
      httpLogger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  
  // Swagger is a dev/staging convenience, not something to expose in
  // production — it documents every endpoint and schema in the API.
  const swaggerEnabled = process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Jibu API')
      .setDescription('API documentation for Jibu Backend')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  if (swaggerEnabled) {
    Logger.log(
      `📚 Swagger documentation available at: http://localhost:${port}/${globalPrefix}/docs`
    );
  }
}

bootstrap();