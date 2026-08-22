import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { json } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { auth } from './core/auth/auth';
import { getSharedPrismaService } from './core/database/prisma.service';

// Polyfill global crypto.randomUUID for @nestjs/schedule which expects a global crypto object
const g: any = global as any;

if (!('crypto' in g)) {
  g.crypto = {};
}

if (!g.crypto.randomUUID) {
  g.crypto.randomUUID = randomUUID;
}

interface AuthResponse {
  user?: {
    id?: string;
  };
}

function getAuthUserId(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'user' in parsed &&
      typeof parsed.user === 'object' &&
      parsed.user !== null &&
      'id' in parsed.user &&
      typeof parsed.user.id === 'string'
    ) {
      return (parsed as AuthResponse).user?.id;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function findWorkspaceId(userId: string): Promise<string | undefined> {
  const prisma = getSharedPrismaService();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastWorkspaceId: true },
    });
    if (user?.lastWorkspaceId) return user.lastWorkspaceId;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return undefined;
}

async function refreshActiveOrganizationCookie(
  responseCookies: string[],
  responseBody: string,
  host: string,
  path: string,
): Promise<string[]> {
  if (!path.endsWith('/sign-up/email') && !path.endsWith('/sign-in/email')) {
    return [];
  }
  const userId = getAuthUserId(responseBody);
  if (!userId) return [];
  const workspaceId = await findWorkspaceId(userId);
  if (!workspaceId) return [];

  const cookieHeader = responseCookies
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
  const activeResponse = await auth.handler(
    new Request(`http://${host}/api/auth/organization/set-active`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ organizationId: workspaceId }),
    }),
  );
  return activeResponse.headers.getSetCookie?.() || [];
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
      const responseBody = await response.text();
      const responseCookies = response.headers.getSetCookie?.() || [];
      const activeOrganizationCookies = response.ok
        ? await refreshActiveOrganizationCookie(
            responseCookies,
            responseBody,
            String(req.headers.host),
            req.originalUrl.split('?')[0],
          )
        : [];
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') res.setHeader(key, value);
      });
      const setCookies = [...responseCookies, ...activeOrganizationCookies];
      if (setCookies.length) res.setHeader('set-cookie', setCookies);
      res.send(responseBody);
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
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

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