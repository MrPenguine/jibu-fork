import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface ListCallsQuery {
  workspaceId: string;
  status?: string;
  direction?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class CallService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCallsQuery) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 25));

    const where = {
      workspaceId: query.workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.agentId ? { agentId: query.agentId } : {}),
    };

    const [total, calls] = await Promise.all([
      this.prisma.call.count({ where }),
      this.prisma.call.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true } },
          phoneNumber: { select: { id: true, number: true, provider: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { calls, total, page, pageSize };
  }

  async summary(workspaceId: string) {
    const [avgDuration, transferred, failed, total] = await Promise.all([
      this.prisma.call.aggregate({
        where: { workspaceId, status: 'completed', durationSeconds: { not: null } },
        _avg: { durationSeconds: true },
      }),
      this.prisma.call.count({ where: { workspaceId, disconnectReason: 'transferred' } }),
      this.prisma.call.count({ where: { workspaceId, status: 'failed' } }),
      this.prisma.call.count({ where: { workspaceId } }),
    ]);
    return {
      avgDurationSeconds: Math.round(avgDuration._avg.durationSeconds || 0),
      transferredCount: transferred,
      failedCount: failed,
      totalCount: total,
    };
  }
}
