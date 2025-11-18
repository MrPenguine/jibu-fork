import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

interface AdminWorkspaceListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

@Injectable()
export class AdminWorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminWorkspaceListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const search = query.search?.trim();
    const where: Prisma.WorkspaceWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.workspace.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              memberships: true,
              agents: true,
              chats: true,
            },
          },
          memberships: {
            where: { role: 'owner' },
            include: { user: true },
            take: 1,
          },
          subscription: {
            include: { plan: true },
          },
        },
      }),
      this.prisma.workspace.count({ where }),
    ]);

    const mapped = (items as any[]).map((ws) => {
      const ownerMembership = ws.memberships[0];
      return {
        id: ws.id,
        name: ws.name,
        email: ws.email,
        createdAt: ws.createdAt,
        isSuspended: ws.isSuspended,
        suspendedAt: ws.suspendedAt,
        suspendedBy: ws.suspendedBy,
        suspensionReason: ws.suspensionReason,
        owner: ownerMembership
          ? {
              membershipId: ownerMembership.id,
              userId: ownerMembership.userId,
              email: ownerMembership.user?.email ?? ownerMembership.email,
            }
          : null,
        membersCount: (ws as any)._count?.memberships ?? 0,
        agentsCount: (ws as any)._count?.agents ?? 0,
        chatsCount: (ws as any)._count?.chats ?? 0,
        subscription: ws.subscription
          ? {
              id: ws.subscription.id,
              status: ws.subscription.status,
              planName: ws.subscription.plan?.name,
            }
          : null,
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
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
        agents: true,
        agentSessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const owner = workspace.memberships.find((m) => m.role === 'owner') ?? null;

    return {
      id: workspace.id,
      name: workspace.name,
      email: workspace.email,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      isSuspended: workspace.isSuspended,
      suspendedAt: workspace.suspendedAt,
      suspendedBy: workspace.suspendedBy,
      suspensionReason: workspace.suspensionReason,
      owner: owner
        ? {
            membershipId: owner.id,
            userId: owner.userId,
            email: owner.user?.email ?? owner.email,
          }
        : null,
      members: workspace.memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user?.email ?? m.email,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt,
      })),
      agents: workspace.agents,
      recentSessions: workspace.agentSessions,
      subscription: workspace.subscription
        ? {
            id: workspace.subscription.id,
            status: workspace.subscription.status,
            planName: workspace.subscription.plan?.name,
            currentPeriodEnd: workspace.subscription.currentPeriodEnd,
          }
        : null,
    };
  }

  async getUsageStats(id: string, days?: number) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const windowDays = Number.isFinite(days as number)
      ? Math.max(1, Math.min(365, days as number))
      : 30;

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const records = await this.prisma.usageRecord.findMany({
      where: {
        workspaceId: id,
        timestamp: { gte: since },
      },
    });

    const totalsByType: Record<string, number> = {};
    const totalsByProvider: Record<string, number> = {};
    let totalCostInMicroUSD = 0;

    for (const rec of records) {
      totalsByType[rec.type] = (totalsByType[rec.type] ?? 0) + rec.unitsConsumed;
      totalsByProvider[rec.provider] =
        (totalsByProvider[rec.provider] ?? 0) + rec.unitsConsumed;
      totalCostInMicroUSD += rec.costInMicroUSD;
    }

    return {
      workspaceId: id,
      days: windowDays,
      totalsByType,
      totalsByProvider,
      totalCostInMicroUSD,
      totalRecords: records.length,
      since,
    };
  }

  async suspend(id: string, reason?: string, adminUserId?: string) {
    const existing = await this.prisma.workspace.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Workspace not found');
    }

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedBy: adminUserId ?? existing.suspendedBy,
        suspensionReason:
          reason ?? existing.suspensionReason ?? 'Suspended by admin',
      },
    });

    return {
      id: updated.id,
      isSuspended: updated.isSuspended,
      suspendedAt: updated.suspendedAt,
      suspendedBy: updated.suspendedBy,
      suspensionReason: updated.suspensionReason,
    };
  }

  async unsuspend(id: string) {
    const existing = await this.prisma.workspace.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Workspace not found');
    }

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        isSuspended: false,
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
      },
    });

    return {
      id: updated.id,
      isSuspended: updated.isSuspended,
      suspendedAt: updated.suspendedAt,
      suspendedBy: updated.suspendedBy,
      suspensionReason: updated.suspensionReason,
    };
  }
}
