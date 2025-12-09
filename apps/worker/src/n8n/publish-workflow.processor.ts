import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
import { QUEUE_NAMES, JOB_NAMES, PublishWorkflowJobData } from '@jibu/queue-definitions';
import { N8nAdminClient } from './n8n-admin.client';
import { WebhookCacheService } from '@jibu/cache-utils';

@Injectable()
@Processor(QUEUE_NAMES.WORKFLOW_PUBLISH)
export class PublishWorkflowProcessor implements OnModuleInit {
  private readonly logger = new Logger(PublishWorkflowProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8nAdmin: N8nAdminClient,
    private readonly webhookCache: WebhookCacheService,
  ) {}

  onModuleInit() {
    this.logger.log(`[DIAGNOSTIC] 🎯 PublishWorkflowProcessor initialized and registered for queue: ${QUEUE_NAMES.WORKFLOW_PUBLISH}`);
    this.logger.log(`[DIAGNOSTIC] 📋 Listening for job: ${JOB_NAMES.PUBLISH_WORKFLOW}`);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`[DIAGNOSTIC] ⚡ Job ${job.id} is now active - Processing workflow ${job.data.workflowId}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`[DIAGNOSTIC] ✅ Job ${job.id} completed successfully for workflow ${job.data.workflowId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`[DIAGNOSTIC] ❌ Job ${job.id} failed for workflow ${job.data.workflowId}: ${err.message}`, err.stack);
  }

  @Process(JOB_NAMES.PUBLISH_WORKFLOW)
  async handle(job: Job<PublishWorkflowJobData>) {
    const { workflowId, workspaceId, n8nWorkflowDbId, activate = false, force = false } = job.data;
    this.logger.log(`[DIAGNOSTIC] 🔄 Starting to process publish job ${job.id}`);
    this.logger.log(`[DIAGNOSTIC] Publishing workflow ${workflowId} (workspace ${workspaceId}), activate=${activate}`);

    try {
      // Step 1: Load workflow from database
      this.logger.log(`[DIAGNOSTIC] Step 1: Loading workflow from database...`);
      const workflow = await this.prisma.workflow.findFirst({
        where: { id: workflowId, workspaceId },
        include: { n8nWorkflow: true },
      });
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId} in workspace ${workspaceId}`);
      }
      this.logger.log(`[DIAGNOSTIC] ✅ Step 1 complete: Workflow loaded: ${workflow.name}`);

      // Step 2: Load compiled JSON from N8nWorkflow row
      this.logger.log(`[DIAGNOSTIC] Step 2: Loading N8nWorkflow row...`);
      const n8nRowId = n8nWorkflowDbId || workflow.n8nWorkflowId;
      const n8nRow = await this.prisma.n8nWorkflow.findFirst({
        where: n8nRowId ? { id: n8nRowId } : { workflows: { some: { id: workflowId } } },
      });
      if (!n8nRow || !n8nRow.workflowJson) {
        throw new Error('Compiled n8n JSON not found; run compile first');
      }
      this.logger.log(`[DIAGNOSTIC] ✅ Step 2 complete: N8nWorkflow row loaded`);

      const payload = n8nRow.workflowJson as any;
      
      // Step 3: Sanitize and prepare payload
      this.logger.log(`[DIAGNOSTIC] Step 3: Sanitizing workflow payload...`);
      const sanitizeWorkflow = (wf: any) => {
        const allowedTop = ['name', 'nodes', 'connections', 'settings'];
        const seen = new Set<string>();
        const nodes = (wf.nodes || []).filter((n: any) => {
          const name = n?.name ?? '';
          if (seen.has(name)) return false;
          seen.add(name);
          return true;
        }).map((n: any) => {
          const allowedNode = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials', 'webhookId', 'disabled', 'notes', 'alwaysOutputData', 'retryOnFail', 'maxTries', 'waitBetweenTries', 'onError'];
          const pruned: any = {};
          for (const k of allowedNode) if (k in n) pruned[k] = n[k];
          return pruned;
        });

        const out: any = { nodes };
        for (const k of allowedTop) {
          if (k === 'nodes') continue;
          if (k in wf) out[k] = wf[k];
        }
        if (!out.settings) out.settings = { executionOrder: 'v1' };
        if (wf.connections) out.connections = wf.connections;

        const webhookName = nodes.find((n: any) => n.type === 'n8n-nodes-base.webhook')?.name || 'Webhook';
        const agentName = nodes.find((n: any) => n.type === '@n8n/n8n-nodes-langchain.agent')?.name || 'AI Agent';
        const providerNode = nodes.find((n: any) => typeof n.type === 'string' && n.type.startsWith('@n8n/n8n-nodes-langchain.lmChat'));
        const providerName = providerNode?.name;

        out.connections = out.connections || {};
        if (webhookName && agentName) {
          const hasMain = Array.isArray(out.connections[webhookName]?.main) && out.connections[webhookName].main.some((arr: any[]) => Array.isArray(arr) && arr.some((c: any) => c?.node === agentName && c?.type === 'main'));
          if (!hasMain) {
            out.connections[webhookName] = out.connections[webhookName] || {};
            out.connections[webhookName].main = out.connections[webhookName].main || [];
            out.connections[webhookName].main.push([{ node: agentName, type: 'main', index: 0 }]);
          }
        }
        if (providerName && agentName) {
          const hasModel = Array.isArray(out.connections[providerName]?.ai_languageModel) && out.connections[providerName].ai_languageModel.some((arr: any[]) => Array.isArray(arr) && arr.some((c: any) => c?.node === agentName && c?.type === 'ai_languageModel'));
          if (!hasModel) {
            out.connections[providerName] = out.connections[providerName] || {};
            out.connections[providerName].ai_languageModel = out.connections[providerName].ai_languageModel || [];
            out.connections[providerName].ai_languageModel.push([{ node: agentName, type: 'ai_languageModel', index: 0 }]);
          }
        }
        return out;
      };
      const body = sanitizeWorkflow(payload);
      this.logger.log(`[DIAGNOSTIC] ✅ Step 3 complete: Payload sanitized`);

      // Step 4: Create or Update workflow in n8n
      let liveId = n8nRow.n8nWorkflowId || undefined;
      this.logger.log(`[DIAGNOSTIC] Step 4: Checking if workflow exists in n8n (liveId: ${liveId})...`);
      if (liveId) {
        const exists = await this.n8nAdmin.workflowExists(liveId);
        if (!exists) {
          this.logger.warn(`[DIAGNOSTIC] ⚠️ Live n8n workflow ${liveId} not found; will create a new one.`);
          liveId = undefined;
        }
      }

      if (!liveId) {
        this.logger.log(`[DIAGNOSTIC] No liveId. Checking for existing workflow by name: "${body.name}"`);
        const byName = body?.name ? await this.n8nAdmin.findWorkflowByName(body.name) : null;
        if (byName?.id) {
          liveId = String(byName.id);
          this.logger.log(`[DIAGNOSTIC] Found by name. Decision: UPDATE_BY_NAME -> ${liveId}`);
          await this.n8nAdmin.updateWorkflow(liveId, body);
        } else {
          this.logger.log(`[DIAGNOSTIC] Not found by name. Decision: CREATE_STUB`);
          const stub = { name: body.name, nodes: [], connections: {}, settings: { executionOrder: 'v1' } };
          const created = await this.n8nAdmin.createWorkflow(stub);
          liveId = String(created.id);
          this.logger.log(`[DIAGNOSTIC] Created stub with ID: ${liveId}. Populating with full definition...`);
          await this.n8nAdmin.updateWorkflow(liveId, body);
        }
      } else {
        this.logger.log(`[DIAGNOSTIC] Found liveId. Decision: UPDATE_BY_ID -> ${liveId}`);
        try {
          await this.n8nAdmin.updateWorkflow(liveId, body);
        } catch (err: any) {
          if (err?.response?.status === 404) {
            this.logger.warn(`[DIAGNOSTIC] ⚠️ UPDATE failed with 404 for ${liveId}; falling back to CREATE.`);
            const created = await this.n8nAdmin.createWorkflow(body);
            liveId = String(created.id);
          } else {
            throw err;
          }
        }
      }
      this.logger.log(`[DIAGNOSTIC] ✅ Step 4 complete: n8n workflow created/updated. Live ID: ${liveId}`);

      // Step 5: Persist n8n's live ID to our database
      this.logger.log(`[DIAGNOSTIC] Step 5: Persisting n8n live ID to database...`);
      await this.prisma.n8nWorkflow.update({ where: { id: n8nRow.id }, data: { n8nWorkflowId: liveId } });
      this.logger.log(`[DIAGNOSTIC] ✅ Step 5 complete: Persisted live ID`);

      // Step 6: Activation policy
      this.logger.log(`[DIAGNOSTIC] Step 6: Handling activation...`);
      if (activate) {
        await this.n8nAdmin.setActive(liveId!, true);
        this.logger.log(`[DIAGNOSTIC] ✅ Step 6 complete: Workflow activated in n8n`);
      } else {
        this.logger.log(`[DIAGNOSTIC] Step 6 complete: Workflow activation skipped`);
      }

      // Step 7: Persist final status and webhook URL
      this.logger.log(`[DIAGNOSTIC] Step 7: Persisting final status to database...`);
      const webhookNode = (payload.nodes || []).find((n: any) => n.type === 'n8n-nodes-base.webhook');
      const webhookPath = webhookNode?.parameters?.path ? String(webhookNode.parameters.path) : undefined;
      const baseEnv = process.env.N8N_WEBHOOK_URL || process.env.N8N_PUBLIC_URL || process.env.N8N_API_URL || '';
      const baseUrl = String(baseEnv).replace(/\/$/, '').replace(/\/?api(?:\/v\d+)?$/, '');

      let webhookId = webhookPath ? webhookPath.trim() : undefined;

      if (webhookId) {
        // Remove any leading slashes
        webhookId = webhookId.replace(/^\/+/, '');

        const segments = webhookId.split('/');

        // Legacy form: api/n8n/hooks/<workflowId>/<versionLabel> -> keep only <workflowId>
        if (segments.length >= 4 && segments[0] === 'api' && segments[1] === 'n8n' && segments[2] === 'hooks') {
          webhookId = segments[3];
        } else if (segments.length > 1) {
          // Generic safety: keep only the last segment as the clean id
          webhookId = segments[segments.length - 1];
        }
      }

      const webhookUrl = webhookId ? `${baseUrl}/webhook/${webhookId}` : undefined;

      await this.prisma.n8nWorkflow.update({
        where: { id: n8nRow.id },
        data: { isActive: !!activate, webhookUrl, lastValidatedAt: new Date() },
      });
      this.logger.log(`[DIAGNOSTIC] ✅ Step 7 complete: Final status persisted`);

      // Step 8: Invalidate webhook cache and populate with fresh data
      this.logger.log(`[DIAGNOSTIC] Step 8: Invalidating webhook cache...`);
      await this.webhookCache.invalidate(workflowId);
      
      if (webhookUrl) {
        // Check if this is a voice workflow
        const isVoiceWorkflow = await this.isVoiceWorkflow(workflowId);
        
        // Add delay for voice workflows to ensure n8n propagation
        if (isVoiceWorkflow) {
          this.logger.log(`[DIAGNOSTIC] Voice workflow detected, adding 100ms delay for n8n propagation`);
          await this.delay(100);
        }
        
        // Populate cache with fresh webhook URL
        await this.webhookCache.setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow);
        this.logger.log(`[DIAGNOSTIC] ✅ Step 8 complete: Cache invalidated and refreshed`);
      } else {
        this.logger.log(`[DIAGNOSTIC] ✅ Step 8 complete: Cache invalidated (no webhook URL to cache)`);
      }

      const result = { n8nWorkflowId: liveId, activated: activate, webhookUrl };
      this.logger.log(`[DIAGNOSTIC] 🎉 Publish completed successfully! Result: ${JSON.stringify(result)}`);
      return result;

    } catch (error) {
      const err = error as Error;
      this.logger.error(`[DIAGNOSTIC] ❌ Fatal error in publish workflow processor: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Check if a workflow is voice-enabled
   */
  private async isVoiceWorkflow(workflowId: string): Promise<boolean> {
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { 
          agent: {
            select: {
              ttsProvider: true,
              sttProvider: true,
            }
          }
        },
      });

      // A workflow is considered voice-enabled if the agent has TTS or STT providers configured
      return !!(workflow?.agent?.ttsProvider || workflow?.agent?.sttProvider);
    } catch (error) {
      this.logger.error(
        `Failed to check if workflow ${workflowId} is voice-enabled: ${error.message}`
      );
      return false; // Default to non-voice on error
    }
  }

  /**
   * Delay helper for voice workflow propagation
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


