import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const [
      totalUsers,
      newUsers30d,
      newUsers7d,
      totalWorkspaces,
      totalAgents,
      activeSessions24h,
      totalMessages,
      messagesLast24h,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.workspace.count(),
      this.prisma.agent.count(),
      this.prisma.agentSession.count({
        where: {
          createdAt: { gte: oneDayAgo },
          status: 'active',
        },
      }),
      this.prisma.message.count(),
      this.prisma.message.count({ where: { createdAt: { gte: oneDayAgo } } }),
    ]);

    const userGrowthRate =
      totalUsers > 0 ? parseFloat(((newUsers30d / totalUsers) * 100).toFixed(1)) : 0;

    return {
      users: {
        total: totalUsers,
        new30d: newUsers30d,
        new7d: newUsers7d,
        growthRate: userGrowthRate,
      },
      workspaces: {
        total: totalWorkspaces,
      },
      agents: {
        total: totalAgents,
        active24h: activeSessions24h,
      },
      messages: {
        total: totalMessages,
        last24h: messagesLast24h,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error?.message ?? 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
