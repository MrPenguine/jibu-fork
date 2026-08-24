import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { ADMIN_ROLES, auth } from '../../../core/auth/auth';

interface AdminUserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminUserListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { fullName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              memberships: true,
              apiKeys: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const mapped = items.map((user) => {
      const displayName =
        user.fullName ||
        (user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.email);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: displayName,
        imageUrl: user.imageUrl,
        isAdmin: user.isAdmin,
        adminRole: user.adminRole,
        isSuspended: user.isSuspended,
        suspendedAt: user.suspendedAt,
        suspensionReason: user.suspensionReason,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        membershipsCount: (user as any)._count?.memberships ?? 0,
        apiKeysCount: (user as any)._count?.apiKeys ?? 0,
      };
    });

    return {
      items: mapped,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        apiKeys: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const workspaces = user.memberships.map((m) => ({
      id: m.workspaceId,
      name: m.workspace?.name,
      role: m.role,
      status: m.status,
      email: m.workspace?.email,
    }));

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      imageUrl: user.imageUrl,
      isAdmin: user.isAdmin,
      adminRole: user.adminRole,
      isSuspended: user.isSuspended,
      suspendedAt: user.suspendedAt,
      suspensionReason: user.suspensionReason,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      workspaces,
      apiKeys: user.apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        workspaceId: k.workspaceId,
        revoked: k.revoked,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
    };
  }

  async getActivityStats(id: string) {
    // Basic activity metrics for now; can be expanded in later phases
    const [workspaceCount, apiKeyCount, invitationsSent] = await Promise.all([
      this.prisma.workspaceMembership.count({ where: { userId: id } }),
      this.prisma.apiKey.count({ where: { userId: id } }),
      this.prisma.invitation.count({ where: { invitedById: id } }),
    ]);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        lastSignInAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      workspaces: workspaceCount,
      apiKeys: apiKeyCount,
      invitationsSent,
      lastSignInAt: user.lastSignInAt,
      joinedAt: user.createdAt,
    };
  }

  async suspend(id: string, reason?: string, headers?: Headers) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await auth.api.banUser({
      body: {
        userId: id,
        banReason: reason ?? existing.suspensionReason ?? 'Suspended by admin',
      },
      headers,
    });
    const updated = await this.syncApplicationUser(id);

    return {
      id: updated.id,
      isSuspended: updated.isSuspended,
      suspendedAt: updated.suspendedAt,
      suspensionReason: updated.suspensionReason,
    };
  }

  async unsuspend(id: string, headers?: Headers) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await auth.api.unbanUser({
      body: { userId: id },
      headers,
    });
    const updated = await this.syncApplicationUser(id);

    return {
      id: updated.id,
      isSuspended: updated.isSuspended,
      suspendedAt: updated.suspendedAt,
      suspensionReason: updated.suspensionReason,
    };
  }

  async setRole(id: string, role: string, headers?: Headers) {
    const normalizedRole = role?.trim();
    if (!normalizedRole || !ADMIN_ROLES.includes(normalizedRole as (typeof ADMIN_ROLES)[number])) {
      throw new BadRequestException('Invalid role');
    }
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await auth.api.setRole({
      body: { userId: id, role: normalizedRole },
      headers,
    });
    const updated = await this.syncApplicationUser(id);

    return {
      id: updated.id,
      isAdmin: updated.isAdmin,
      adminRole: updated.adminRole,
    };
  }

  private async syncApplicationUser(id: string) {
    const authUser = await this.prisma.authUser.findUnique({
      where: { id },
      select: { role: true, banned: true, banReason: true, banExpires: true },
    });
    if (!authUser) {
      throw new NotFoundException('Authentication user not found');
    }
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { isSuspended: true, suspendedAt: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const suspended = Boolean(
      authUser.banned &&
        (!authUser.banExpires || authUser.banExpires.getTime() > Date.now()),
    );
    const suspendedAt = suspended
      ? existing.isSuspended && existing.suspendedAt
        ? existing.suspendedAt
        : new Date()
      : null;
    return this.prisma.user.update({
      where: { id },
      data: {
        isAdmin: ADMIN_ROLES.includes(authUser.role as (typeof ADMIN_ROLES)[number]),
        adminRole: authUser.role,
        isSuspended: suspended,
        suspendedAt,
        suspensionReason: suspended ? authUser.banReason || 'Banned by admin' : null,
      },
    });
  }
}
