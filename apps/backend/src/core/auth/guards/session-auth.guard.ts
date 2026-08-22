import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { auth } from '../auth';
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
    if (!session?.user) return false;

    const user = await this.prisma.user.findUnique({
      where: { id: session.user.id },
      include: { lastWorkspace: true },
    });
    if (!user) return false;

    request.session = session;
    request.user = {
      ...session.user,
      ...user,
      userId: user.id,
      workspaceId: user.lastWorkspaceId,
    };
    return true;
  }
}
