import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AdminAuditMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    const startTime = Date.now();

    if (!user?.isAdmin) {
      return next();
    }

    res.on('finish', async () => {
      try {
        if (res.statusCode < 400 && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
          await this.prisma.adminAuditLog.create({
            data: {
              adminUserId: user.id,
              action: `${req.method} ${req.path}`,
              targetType: this.extractTargetType(req.path),
              targetId: this.extractTargetId(req.path),
              details: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: Date.now() - startTime,
                query: req.query,
                body: this.sanitizeBody((req as any).body),
              },
              ipAddress: this.getClientIP(req as any),
              userAgent: req.headers['user-agent'] || null,
            },
          });
        }
      } catch (error) {
        console.error('Failed to create admin audit log', error);
      }
    });

    next();
  }

  private extractTargetType(path: string): string | null {
    if (path.includes('/users/')) return 'User';
    if (path.includes('/workspaces/')) return 'Workspace';
    if (path.includes('/plans/')) return 'Plan';
    if (path.includes('/subscriptions/')) return 'Subscription';
    if (path.includes('/agents/')) return 'Agent';
    return null;
  }

  private extractTargetId(path: string): string | null {
    const match = path.match(/\/([a-z0-9]{20,}|[a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.ip
    );
  }
}
