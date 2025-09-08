import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import { QUEUE_NAMES, JOB_NAMES, PublishWorkflowJobData } from '@jibu/queue-definitions';
import { N8nAdminClient } from './n8n-admin.client';

@Injectable()
@Processor(QUEUE_NAMES.WORKFLOW_PUBLISH)
export class PublishWorkflowProcessor {
  private readonly logger = new Logger(PublishWorkflowProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8nAdmin: N8nAdminClient,
  ) {}

  @Process(JOB_NAMES.PUBLISH_WORKFLOW)
  async handle(job: Job<PublishWorkflowJobData>) {
    const { workflowId, workspaceId, n8nWorkflowDbId, activate = false, force = false } = job.data;
    this.logger.log(`Publishing workflow ${workflowId} (workspace ${workspaceId}), job ${job.id}`);

    // Load workflow with link and compiled JSON
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, workspaceId },
      include: { n8nWorkflow: true },
    });
    if (!workflow) throw new Error('Workflow not found for publish');

    const n8nRowId = n8nWorkflowDbId || workflow.n8nWorkflowId;
    const n8nRow = await this.prisma.n8nWorkflow.findFirst({
      where: n8nRowId ? { id: n8nRowId } : { workflows: { some: { id: workflowId } } },
    });
    if (!n8nRow || !n8nRow.workflowJson) throw new Error('Compiled n8n JSON not found; run compile first');

    const payload = n8nRow.workflowJson as any;

    // Create vs Update in n8n
    let liveId = workflow.n8nWorkflowId && !String(workflow.n8nWorkflowId).startsWith('provisional:')
      ? workflow.n8nWorkflowId
      : undefined;

    if (!liveId) {
      const created = await this.n8nAdmin.createWorkflow(payload);
      liveId = String(created.id);
      // Persist the real live id
      await this.prisma.workflow.update({ where: { id: workflowId }, data: { n8nWorkflowId: liveId } });
      await this.prisma.n8nWorkflow.update({ where: { id: n8nRow.id }, data: { n8nWorkflowId: liveId } });
      this.logger.log(`Created n8n workflow ${liveId} for workflow ${workflowId}`);
    } else {
      await this.n8nAdmin.updateWorkflow(liveId, payload);
      this.logger.log(`Updated n8n workflow ${liveId} for workflow ${workflowId}`);
    }

    // Activation policy
    if (activate) {
      await this.n8nAdmin.setActive(liveId!, true);
    }

    // Persist status
    const webhookNode = (payload.nodes || []).find((n: any) => n.type === 'n8n-nodes-base.webhook');
    const webhookPath = webhookNode?.parameters?.path ? String(webhookNode.parameters.path) : undefined;
    const baseUrl = process.env.N8N_PUBLIC_URL || process.env.N8N_API_URL?.replace(/\/?api$/, '') || '';
    const webhookUrl = webhookPath ? `${baseUrl}/webhook/${webhookPath}` : undefined;

    await this.prisma.n8nWorkflow.update({
      where: { id: n8nRow.id },
      data: {
        isActive: !!activate,
        webhookUrl,
        lastValidatedAt: new Date(),
      },
    });

    return {
      n8nWorkflowId: liveId,
      activated: activate,
      webhookUrl,
    };
  }
}
