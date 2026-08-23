import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { auth, provisionApplicationUser } from '../auth';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers?.['x-api-key'];
    const apiKeyValue = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    if (typeof apiKeyValue === 'string' && apiKeyValue.length > 0) {
      let verified;
      try {
        verified = await auth.api.verifyApiKey({
          body: { key: apiKeyValue },
        });
      } catch {
        throw new UnauthorizedException();
      }
      if (!verified.valid || !verified.key) {
        throw new UnauthorizedException();
      }

      const metadata =
        verified.key.metadata && typeof verified.key.metadata === 'object'
          ? verified.key.metadata as Record<string, unknown>
          : {};
      const createdByUserId = metadata.createdByUserId;
      if (typeof createdByUserId !== 'string') {
        throw new UnauthorizedException();
      }
      const user = await this.prisma.user.findUnique({
        where: { id: createdByUserId },
        include: { lastWorkspace: true },
      });
      if (!user) {
        throw new UnauthorizedException();
      }

      request.user = {
        ...user,
        userId: user.id,
        workspaceId: verified.key.referenceId,
        lastWorkspaceId: verified.key.referenceId,
        workspaceRole: undefined,
      };
      request.apiKeyWorkspaceId = verified.key.referenceId;
      request.apiKey = {
        id: verified.key.id,
        referenceId: verified.key.referenceId,
        metadata,
      };
      return true;
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    }
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      throw new UnauthorizedException();
    }

    let user = await this.prisma.user.findUnique({
      where: { id: session.user.id },
      include: { lastWorkspace: true },
    });
    if (!user) {
      try {
        await provisionApplicationUser(session.user);
        user = await this.prisma.user.findUnique({
          where: { id: session.user.id },
          include: { lastWorkspace: true },
        });
      } catch {
        throw new UnauthorizedException('Unable to provision application user');
      }
    }
    if (!user) {
      throw new UnauthorizedException();
    }

    request.session = session;
    request.user = {
      ...session.user,
      ...user,
      userId: user.id,
      workspaceId: user.lastWorkspaceId,
      workspaceRole: undefined,
    };
    return true;
  }
}
