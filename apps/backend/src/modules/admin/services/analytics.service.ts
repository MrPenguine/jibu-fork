import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AdminUsageService } from './usage.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageService: AdminUsageService,
  ) {}

  async getRevenueMetrics(days?: number) {
    const periodDays = Number.isFinite(days as number)
      ? Math.max(1, Math.min(365, days as number))
      : 30;

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: ['active', 'trialing'],
        },
      },
      include: {
        plan: true,
      },
    });

    let mrrUsd = 0;
    let arrUsd = 0;
    const byPlanMap: Record<string, { planId: string; planName: string; mrrUsd: number; arrUsd: number; activeSubscriptions: number }> = {};

    for (const sub of subscriptions) {
      const plan = sub.plan;
      if (!plan) {
        continue;
      }

      const monthlyFromMonthly = plan.priceMonthly ?? 0;
      const monthlyFromYearly = plan.priceMonthly == null && plan.priceYearly != null
        ? plan.priceYearly / 12
        : 0;
      const subMrr = monthlyFromMonthly || monthlyFromYearly;
      const subArr = subMrr * 12;

      mrrUsd += subMrr;
      arrUsd += subArr;

      const key = plan.id;
      if (!byPlanMap[key]) {
        byPlanMap[key] = {
          planId: plan.id,
          planName: plan.name,
          mrrUsd: 0,
          arrUsd: 0,
          activeSubscriptions: 0,
        };
      }

      byPlanMap[key].mrrUsd += subMrr;
      byPlanMap[key].arrUsd += subArr;
      byPlanMap[key].activeSubscriptions += 1;
    }

    const byPlan = Object.values(byPlanMap).sort((a, b) => b.mrrUsd - a.mrrUsd);

    return {
      periodDays,
      activeSubscriptions: subscriptions.length,
      mrrUsd,
      arrUsd,
      byPlan,
      timestamp: new Date().toISOString(),
    };
  }

  async getCostBreakdown(days?: number) {
    const costs = await this.usageService.getProviderCosts(days);

    const totalCostUsd = costs.totalCostInMicroUSD / 1_000_000;

    const byProviderList = Object.entries(costs.byProvider).map(([provider, micro]) => {
      const costInMicroUSD = micro ?? 0;
      const costUsd = costInMicroUSD / 1_000_000;
      return {
        provider,
        costInMicroUSD,
        costUsd,
      };
    });

    const byTypeList = Object.entries(costs.byType).map(([type, micro]) => {
      const costInMicroUSD = micro ?? 0;
      const costUsd = costInMicroUSD / 1_000_000;
      return {
        type,
        costInMicroUSD,
        costUsd,
      };
    });

    return {
      days: costs.days,
      since: costs.since,
      totalCostInMicroUSD: costs.totalCostInMicroUSD,
      totalCostUsd,
      byProvider: byProviderList,
      byType: byTypeList,
    };
  }

  async getMarginAnalysis(days?: number) {
    const periodDays = Number.isFinite(days as number)
      ? Math.max(1, Math.min(365, days as number))
      : 30;

    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: ['active', 'trialing'],
        },
      },
      include: {
        plan: true,
        workspace: true,
      },
    });

    const usageGrouped = await this.prisma.usageRecord.groupBy({
      by: ['workspaceId'],
      where: {
        timestamp: { gte: since },
      },
      _sum: {
        costInMicroUSD: true,
      },
    });

    const costMap: Record<string, number> = {};
    for (const g of usageGrouped) {
      costMap[g.workspaceId] = g._sum.costInMicroUSD ?? 0;
    }

    const items = subscriptions.map((sub) => {
      const plan = sub.plan;
      const workspace = sub.workspace;

      if (!plan || !workspace) {
        return null;
      }

      const monthlyFromMonthly = plan.priceMonthly ?? 0;
      const monthlyFromYearly = plan.priceMonthly == null && plan.priceYearly != null
        ? plan.priceYearly / 12
        : 0;
      const mrrUsd = monthlyFromMonthly || monthlyFromYearly;

      const costMicro = costMap[sub.workspaceId] ?? 0;
      const costUsd = costMicro / 1_000_000;

      const marginUsd = mrrUsd - costUsd;
      const marginPct = mrrUsd > 0 ? Number(((marginUsd / mrrUsd) * 100).toFixed(1)) : null;

      return {
        workspaceId: sub.workspaceId,
        workspaceName: workspace.name,
        workspaceEmail: workspace.email,
        mrrUsd,
        costUsd,
        marginUsd,
        marginPct,
      };
    }).filter((item) => item !== null) as Array<{
      workspaceId: string;
      workspaceName: string | null;
      workspaceEmail: string | null;
      mrrUsd: number;
      costUsd: number;
      marginUsd: number;
      marginPct: number | null;
    }>;

    items.sort((a, b) => b.marginUsd - a.marginUsd);

    return {
      days: periodDays,
      since,
      items,
    };
  }
}
