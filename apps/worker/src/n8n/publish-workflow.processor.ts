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
    // Debug: print the payload we're pushing to n8n
    try {
      const json = JSON.stringify(payload);
      const preview = json.length > 5000 ? json.slice(0, 5000) + '...<truncated>' : json;
      this.logger.debug(`n8n payload (worker): ${preview}`);
    } catch {}

    // Prepare sanitized payload for n8n API
    const sanitizeWorkflow = (wf: any) => {
      const allowedTop = ['name', 'nodes', 'connections', 'settings'];
      // Deduplicate nodes by name (n8n requires unique node names)
      const seen = new Set<string>();
      const nodes = Array.isArray(wf.nodes)
        ? wf.nodes.filter((n: any) => {
            const name = n?.name ?? '';
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
          }).map((n: any) => {
            const allowedNode = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials', 'webhookId', 'disabled', 'notes', 'alwaysOutputData', 'retryOnFail', 'maxTries', 'waitBetweenTries', 'onError'];
            const pruned: any = {};
            for (const k of allowedNode) if (k in n) pruned[k] = n[k];
            return pruned;
          })
        : [];

      const out: any = { nodes };
      for (const k of allowedTop) {
        if (k === 'nodes') continue;
        if (k in wf) out[k] = wf[k];
      }
      // Default settings
      if (!out.settings) out.settings = { executionOrder: 'v1' };
      // Do not include 'active' in body (read-only in n8n API). Activation handled separately.
      // Copy connections as-is
      if (wf.connections) out.connections = wf.connections;

      // Ensure required connections exist
      const webhookName = nodes.find((n: any) => n.type === 'n8n-nodes-base.webhook')?.name || 'Webhook';
      const agentName = nodes.find((n: any) => n.type === '@n8n/n8n-nodes-langchain.agent')?.name || 'AI Agent';
      const providerNode = nodes.find((n: any) => typeof n.type === 'string' && n.type.startsWith('@n8n/n8n-nodes-langchain.lmChat'));
      const providerName = providerNode?.name;

      out.connections = out.connections || {};

      // Webhook -> AI Agent (main)
      if (webhookName && agentName) {
        const hasMain = Array.isArray(out.connections[webhookName]?.main)
          && out.connections[webhookName].main.some((arr: any[]) => Array.isArray(arr) && arr.some((c: any) => c?.node === agentName && c?.type === 'main'));
        if (!hasMain) {
          out.connections[webhookName] = out.connections[webhookName] || {};
          out.connections[webhookName].main = out.connections[webhookName].main || [];
          out.connections[webhookName].main.push([
            { node: agentName, type: 'main', index: 0 },
          ]);
        }
      }

      // Provider -> AI Agent (ai_languageModel)
      if (providerName && agentName) {
        const hasModel = Array.isArray(out.connections[providerName]?.ai_languageModel)
          && out.connections[providerName].ai_languageModel.some((arr: any[]) => Array.isArray(arr) && arr.some((c: any) => c?.node === agentName && c?.type === 'ai_languageModel'));
        if (!hasModel) {
          out.connections[providerName] = out.connections[providerName] || {};
          out.connections[providerName].ai_languageModel = out.connections[providerName].ai_languageModel || [];
          out.connections[providerName].ai_languageModel.push([
            { node: agentName, type: 'ai_languageModel', index: 0 },
          ]);
        }
      }
      return out;
    };
    const body = sanitizeWorkflow(payload);

    // Create vs Update in n8n
    let liveId = workflow.n8nWorkflowId && !String(workflow.n8nWorkflowId).startsWith('provisional:')
      ? workflow.n8nWorkflowId
      : undefined;

    // If we think we have a liveId, verify it exists in n8n first
    if (liveId) {
      const exists = await this.n8nAdmin.workflowExists(liveId);
      if (!exists) {
        this.logger.warn(`Live n8n workflow ${liveId} not found; will create a new one.`);
        liveId = undefined;
      }
    }

    if (!liveId) {
      // Idempotency by name to avoid duplicates
      const byName = body?.name ? await this.n8nAdmin.findWorkflowByName(body.name) : null;
      if (byName?.id) {
        liveId = String(byName.id);
        await this.n8nAdmin.updateWorkflow(liveId, body);
        await this.prisma.workflow.update({ where: { id: workflowId }, data: { n8nWorkflowId: liveId } });
        await this.prisma.n8nWorkflow.update({ where: { id: n8nRow.id }, data: { n8nWorkflowId: liveId } });
        this.logger.log(`UPDATE (by-name) n8n workflow ${liveId} for workflow ${workflowId}`);
      } else {
        // Create a minimal stub first to obtain a durable ID, then update with full body
        const stub = {
          name: body.name,
          nodes: [],
          connections: {},
          settings: { executionOrder: 'v1' },
        } as any;
        const created = await this.n8nAdmin.createWorkflow(stub);
        liveId = String(created.id);
        // Persist the real live id immediately to avoid duplicate creations on retries
        await this.prisma.workflow.update({ where: { id: workflowId }, data: { n8nWorkflowId: liveId } });
        await this.prisma.n8nWorkflow.update({ where: { id: n8nRow.id }, data: { n8nWorkflowId: liveId } });
        this.logger.log(`CREATE (stub) n8n workflow ${liveId} for workflow ${workflowId}`);
        // Now populate with the full definition
        await this.n8nAdmin.updateWorkflow(liveId, body);
        this.logger.log(`POPULATE n8n workflow ${liveId} for workflow ${workflowId}`);
      }
    } else {
      try {
        await this.n8nAdmin.updateWorkflow(liveId, body);
        this.logger.log(`UPDATE n8n workflow ${liveId} for workflow ${workflowId}`);
      } catch (err: any) {
        // If update fails with 404, fallback to create
        if (err?.response?.status === 404) {
          this.logger.warn(`UPDATE failed with 404 for ${liveId}; falling back to CREATE.`);
          const created = await this.n8nAdmin.createWorkflow(body);
          liveId = String(created.id);
          await this.prisma.workflow.update({ where: { id: workflowId }, data: { n8nWorkflowId: liveId } });
          await this.prisma.n8nWorkflow.update({ where: { id: n8nRow.id }, data: { n8nWorkflowId: liveId } });
          this.logger.log(`CREATE n8n workflow ${liveId} (after 404) for workflow ${workflowId}`);
        } else {
          throw err;
        }
      }
    }

    // Activation policy
    if (activate) {
      await this.n8nAdmin.setActive(liveId!, true);
    }

    // Persist status
    const webhookNode = (payload.nodes || []).find((n: any) => n.type === 'n8n-nodes-base.webhook');
    const webhookPath = webhookNode?.parameters?.path ? String(webhookNode.parameters.path) : undefined;
    // Priority: N8N_WEBHOOK_URL > N8N_PUBLIC_URL > derived from N8N_API_URL
    const baseEnv = process.env.N8N_WEBHOOK_URL || process.env.N8N_PUBLIC_URL || process.env.N8N_API_URL || '';
    const baseUrl = String(baseEnv).replace(/\/$/, '').replace(/\/?api(?:\/v\d+)?$/, '');
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
