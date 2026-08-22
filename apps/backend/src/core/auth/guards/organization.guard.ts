import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface OrganizationRequest {
  user?: {
    id?: string;
    userId?: string;
    lastWorkspaceId?: string | null;
    workspaceId?: string | null;
    workspaceRole?: string | null;
  };
  session?: {
    session?: {
      activeOrganizationId?: string | null;
    };
  };
  params?: Record<string, string | undefined>;
  baseUrl?: string;
  path?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  membership?: unknown;
}

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OrganizationRequest>();
    const userId = request.user?.userId || request.user?.id;
    const isWorkspaceRoute =
      request.path?.includes('/workspaces/') &&
      !request.path.includes('/workspaces/invitations/');
    const workspaceRouteId =
      isWorkspaceRoute
        ? request.params?.id
        : undefined;
    const selectedWorkspaceId =
      request.params?.workspaceId ||
      request.params?.organizationId ||
      workspaceRouteId ||
      this.readBodyWorkspaceId(request.body) ||
      request.query?.workspaceId ||
      this.readHeader(request.headers, 'x-workspace-id') ||
      this.readHeader(request.headers, 'workspace-id') ||
      request.session?.session?.activeOrganizationId ||
      request.user?.lastWorkspaceId ||
      undefined;

    if (!userId || !selectedWorkspaceId) {
      throw new ForbiddenException('A workspace is required for this request');
    }

    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId: selectedWorkspaceId,
        status: 'active',
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    request.membership = membership;
    if (request.user) {
      request.user.workspaceId = membership.workspaceId;
      request.user.lastWorkspaceId = membership.workspaceId;
      request.user.workspaceRole = membership.role;
    }
    return true;
  }

  private readBodyWorkspaceId(body: Record<string, unknown> | undefined): string | undefined {
    const workspaceId = body?.workspaceId || body?.organizationId;
    return typeof workspaceId === 'string' ? workspaceId : undefined;
  }

  private readHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
