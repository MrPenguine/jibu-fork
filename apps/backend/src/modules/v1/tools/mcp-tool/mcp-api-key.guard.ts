import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../core/database/prisma.service';

@Injectable()
export class McpApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(McpApiKeyGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-vapi-secret'] || request.headers['x-api-key'];
    
    // If no API key is provided, check if the endpoint is marked as public
    const isPublic = Reflect.getMetadata('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }
    
    // For development purposes, allow access without authentication
    // IMPORTANT: Remove this in production!
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      this.logger.warn('Development mode: Allowing access without authentication');
      return true;
    }

    if (!apiKey) {
      this.logger.warn('Unauthorized MCP access attempt. Missing API key.');
      throw new UnauthorizedException('Missing API key for MCP server');
    }

    // Check if the API key is valid for any organization
    const tool = await this.prisma.tool.findFirst({
      where: {
        type: 'mcp.execute',
        metadata: {
          path: ['serverToken'],
          equals: apiKey
        }
      }
    });

    if (tool) {
      // Add the organization ID to the request for later use
      request.organizationId = tool.organizationId;
      return true;
    }

    // Check if it matches the global MCP server secret (if configured)
    const globalSecret = this.configService.get<string>('MCP_SERVER_SECRET');
    if (globalSecret && apiKey === globalSecret) {
      return true;
    }

    this.logger.warn(`Unauthorized MCP access attempt. Invalid API key: ${apiKey.substring(0, 5)}...`);
    throw new UnauthorizedException('Invalid API key for MCP server');
  }
}
