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

    const authUser = session.user as typeof session.user & {
      role?: string | null;
      banned?: boolean;
      banReason?: string | null;
      banExpires?: Date | string | null;
    };
    const banExpires = authUser.banExpires ? new Date(authUser.banExpires) : null;
    const isBanned = Boolean(
      authUser.banned && (!banExpires || banExpires.getTime() > Date.now()),
    );
    if (isBanned || user.isSuspended) {
      throw new UnauthorizedException('Account suspended');
    }

    const adminRole = authUser.role || user.adminRole;
    const isAdmin = ['admin', 'superadmin'].includes(adminRole || '');
    request.session = session;
    request.user = {
      ...session.user,
      ...user,
      isAdmin,
      adminRole,
      userId: user.id,
      workspaceId: user.lastWorkspaceId,
      workspaceRole: undefined,
    };
    return true;
  }
}
