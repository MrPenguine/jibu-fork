import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

interface AdminSubscriptionListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  planId?: string;
  search?: string;
}

export interface CreateSubscriptionInput {
  workspaceId: string;
  planId: string;
  status?: string;
}

export interface UpdateSubscriptionInput {
  planId?: string;
  status?: string;
}

@Injectable()
export class AdminSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminSubscriptionListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.SubscriptionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.planId) {
      where.planId = query.planId;
    }

    const search = query.search?.trim();
    if (search) {
      where.workspace = {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          workspace: true,
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findOne(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        workspace: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async create(input: CreateSubscriptionInput) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: input.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Plan not found or inactive');
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { workspaceId: input.workspaceId },
    });

    if (existing) {
      throw new BadRequestException('Workspace already has a subscription');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const status = input.status ?? 'active';

    const created = await this.prisma.subscription.create({
      data: {
        workspaceId: input.workspaceId,
        planId: input.planId,
        status,
        currentPeriodEnd: periodEnd,
        creditsLimit: plan.creditsIncluded,
      },
      include: {
        workspace: true,
        plan: true,
      },
    });

    return created;
  }

  async update(id: string, input: UpdateSubscriptionInput) {
    const existing = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    let planId = existing.planId;
    let creditsLimit = existing.creditsLimit;

    if (input.planId && input.planId !== existing.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: input.planId },
      });

      if (!plan || !plan.isActive) {
        throw new BadRequestException('Plan not found or inactive');
      }

      planId = plan.id;
      creditsLimit = plan.creditsIncluded;
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        planId,
        status: input.status ?? existing.status,
        creditsLimit,
      },
      include: {
        workspace: true,
        plan: true,
      },
    });

    return updated;
  }

  async cancel(id: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    const now = new Date();

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'canceled',
        currentPeriodEnd: now,
      },
      include: {
        workspace: true,
        plan: true,
      },
    });

    return updated;
  }
}
