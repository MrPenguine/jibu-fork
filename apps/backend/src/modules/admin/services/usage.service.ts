import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

export interface RecordUsageInput {
  workspaceId: string;
  agentId?: string | null;
  type: string;
  provider: string;
  modelUsed?: string | null;
  unitsConsumed: number;
  costInMicroUSD: number;
  sessionId?: string | null;
}

@Injectable()
export class AdminUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async recordUsage(input: RecordUsageInput) {
    const created = await this.prisma.usageRecord.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId ?? null,
        type: input.type,
        provider: input.provider,
        modelUsed: input.modelUsed ?? null,
        unitsConsumed: input.unitsConsumed,
        costInMicroUSD: input.costInMicroUSD,
        sessionId: input.sessionId ?? null,
      },
    });

    return created;
  }

  async getWorkspaceUsage(workspaceId: string, days?: number) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
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
        workspaceId,
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
      workspaceId,
      days: windowDays,
      totalsByType,
      totalsByProvider,
      totalCostInMicroUSD,
      totalRecords: records.length,
      since,
    };
  }

  async getProviderCosts(days?: number) {
    const windowDays = Number.isFinite(days as number)
      ? Math.max(1, Math.min(365, days as number))
      : 30;

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const records = await this.prisma.usageRecord.findMany({
      where: {
        timestamp: { gte: since },
      },
    });

    const byProviderCost: Record<string, number> = {};
    const byTypeCost: Record<string, number> = {};
    let totalCostInMicroUSD = 0;

    for (const rec of records) {
      byProviderCost[rec.provider] =
        (byProviderCost[rec.provider] ?? 0) + rec.costInMicroUSD;
      byTypeCost[rec.type] = (byTypeCost[rec.type] ?? 0) + rec.costInMicroUSD;
      totalCostInMicroUSD += rec.costInMicroUSD;
    }

    return {
      days: windowDays,
      since,
      totalCostInMicroUSD,
      byProvider: byProviderCost,
      byType: byTypeCost,
    };
  }

  async getTopWorkspaces(limit?: number, days?: number) {
    const windowDays = Number.isFinite(days as number)
      ? Math.max(1, Math.min(365, days as number))
      : 30;

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const topLimit = Number.isFinite(limit as number)
      ? Math.max(1, Math.min(100, limit as number))
      : 10;

    const grouped = await this.prisma.usageRecord.groupBy({
      by: ['workspaceId'],
      where: {
        timestamp: { gte: since },
      },
      _sum: {
        costInMicroUSD: true,
      },
      orderBy: {
        _sum: {
          costInMicroUSD: 'desc',
        },
      },
      take: topLimit,
    });

    const workspaceIds = grouped.map((g) => g.workspaceId);

    const workspaces = await this.prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const workspaceMap: Record<string, { id: string; name: string | null; email: string | null }> = {};
    for (const ws of workspaces) {
      workspaceMap[ws.id] = { id: ws.id, name: ws.name, email: ws.email };
    }

    const items = grouped.map((g) => {
      const ws = workspaceMap[g.workspaceId];
      const totalCostInMicroUSD = g._sum.costInMicroUSD ?? 0;
      const totalCostUsd = totalCostInMicroUSD / 1_000_000;

      return {
        workspaceId: g.workspaceId,
        workspaceName: ws?.name ?? null,
        workspaceEmail: ws?.email ?? null,
        totalCostInMicroUSD,
        totalCostUsd,
      };
    });

    return {
      days: windowDays,
      since,
      items,
    };
  }
}
