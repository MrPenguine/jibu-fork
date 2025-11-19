import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

export interface CreatePlanInput {
  name: string;
  priceMonthly?: number | null;
  priceYearly?: number | null;
  creditsIncluded: number;
  features: Prisma.JsonValue;
}

export interface UpdatePlanInput {
  name?: string;
  priceMonthly?: number | null;
  priceYearly?: number | null;
  creditsIncluded?: number;
  features?: Prisma.JsonValue;
  isActive?: boolean;
}

@Injectable()
export class AdminPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        subscriptions: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return plans.map((plan) => {
      const activeSubscriptionsCount = plan.subscriptions.filter((s) =>
        ['active', 'trialing'].includes(s.status),
      ).length;

      // Strip subscriptions array in favor of a simple count
      const { subscriptions, ...rest } = plan as any;
      return {
        ...rest,
        activeSubscriptionsCount,
      };
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          select: {
            id: true,
            workspaceId: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  async create(input: CreatePlanInput) {
    const created = await this.prisma.plan.create({
      data: {
        name: input.name,
        priceMonthly: input.priceMonthly ?? null,
        priceYearly: input.priceYearly ?? null,
        creditsIncluded: input.creditsIncluded,
        features: input.features,
        isActive: true,
      },
    });

    return created;
  }

  async update(id: string, input: UpdatePlanInput) {
    // Ensure the plan exists first for a nicer error
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        priceMonthly:
          input.priceMonthly !== undefined ? input.priceMonthly : existing.priceMonthly,
        priceYearly:
          input.priceYearly !== undefined ? input.priceYearly : existing.priceYearly,
        creditsIncluded:
          input.creditsIncluded !== undefined
            ? input.creditsIncluded
            : existing.creditsIncluded,
        features: input.features ?? existing.features,
        isActive:
          input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    return updated;
  }

  async deactivate(id: string) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Plan not found');
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });

    return updated;
  }
}
