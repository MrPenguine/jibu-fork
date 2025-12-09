import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { WebhookUrlService } from './webhook-url.service';

@Injectable()
export class WebhookRefreshScheduler {
  private readonly logger = new Logger(WebhookRefreshScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookUrlService: WebhookUrlService,
  ) {}

  @Cron('0 */5 * * * *')
  async refreshActiveVoiceWorkflows(): Promise<void> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    try {
      const sessions = await this.prisma.agentSession.findMany({
        where: {
          updatedAt: { gte: cutoff },
          status: { in: ['ACTIVE', 'active', 'ringing', 'in-progress'] },
          agent: {
            OR: [
              { ttsProvider: { not: null } },
              { sttProvider: { not: null } },
            ],
          },
        },
        include: {
          agent: {
            select: { primaryWorkflowId: true },
          },
        },
      });

      const workflowIds = Array.from(
        new Set(
          sessions
            .map((session) => session.agent?.primaryWorkflowId)
            .filter((id): id is string => !!id),
        ),
      );

      if (workflowIds.length === 0) {
        this.logger.debug('No active voice workflows found for webhook refresh');
        return;
      }

      await this.webhookUrlService.batchRefreshWebhookUrls(workflowIds);

      this.logger.log(
        `Refreshed webhook URLs for ${workflowIds.length} active voice workflows`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to refresh active voice workflow webhook URLs: ${err.message}`,
        err.stack,
      );
    }
  }
}
