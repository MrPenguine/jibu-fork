import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { WebhookCacheService } from '@jibu/cache-utils';

/**
 * Backend service for webhook URL management
 * Uses shared WebhookCacheService for caching
 * Optimized for voice applications with strict latency requirements
 */
@Injectable()
export class WebhookUrlService {
  private readonly logger = new Logger(WebhookUrlService.name);
  private readonly REFRESH_TIMEOUT_MS = 2000; // Voice-optimized timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: WebhookCacheService,
  ) {}

  /**
   * Refresh webhook URL for a workflow
   * @param workflowId - The workflow ID to refresh
   * @returns The updated webhook URL or null if failed
   */
  async refreshWebhookUrl(workflowId: string): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      // Step 1: Verify workflow has published version by checking n8nWorkflowId
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { n8nWorkflow: true },
      });

      if (!workflow) {
        this.logger.warn(`Workflow not found: ${workflowId}`);
        return null;
      }

      if (!workflow.n8nWorkflow) {
        this.logger.warn(`No n8n workflow linked for workflow: ${workflowId}`);
        return null;
      }

      if (!workflow.n8nWorkflow.n8nWorkflowId) {
        this.logger.warn(`Workflow ${workflowId} has no published version (no n8nWorkflowId)`);
        return null;
      }

      // Step 2: Extract webhook path from workflow.nodes
      const workflowJson = workflow.n8nWorkflow.workflowJson as any;
      if (!workflowJson || !workflowJson.nodes) {
        this.logger.warn(`No workflow JSON found for workflow: ${workflowId}`);
        return null;
      }

      const webhookNode = workflowJson.nodes.find(
        (node: any) => node.type === 'n8n-nodes-base.webhook'
      );

      if (!webhookNode || !webhookNode.parameters?.path) {
        this.logger.warn(`No webhook node found in workflow: ${workflowId}`);
        return null;
      }

      let webhookPath = String(webhookNode.parameters.path);

      // Step 3: Normalize the webhook path so we do not end up with
      // a double slash when concatenating with the base URL.
      // n8n paths are often configured with a leading '/', e.g. '/my-hook'.
      // We always want baseUrl + '/webhook/' + '<path-without-leading-slash>'.
      webhookPath = webhookPath.replace(/^\/+/, '');

      // Step 4: Rebuild URL using environment priority
      const baseUrl = this.resolveBaseUrl();
      const webhookUrl = `${baseUrl}/webhook/${webhookPath}`;

      // Step 5: Update N8nWorkflow table with new webhookUrl and lastValidatedAt
      await this.prisma.n8nWorkflow.update({
        where: { id: workflow.n8nWorkflow.id },
        data: {
          webhookUrl,
          lastValidatedAt: new Date(),
        },
      });

      // Step 6: Invalidate cache and populate with fresh data
      await this.cacheService.invalidate(workflowId);
      
      // Determine if this is a voice workflow based on agent settings
      const isVoiceWorkflow = await this.isVoiceWorkflow(workflowId);
      await this.cacheService.setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Webhook URL refreshed for workflow ${workflowId} in ${duration}ms: ${webhookUrl}`
      );

      // Log warning if refresh took too long for voice applications
      if (duration > this.REFRESH_TIMEOUT_MS) {
        this.logger.warn(
          `Webhook refresh exceeded voice timeout threshold (${duration}ms > ${this.REFRESH_TIMEOUT_MS}ms)`
        );
      }

      // Reset circuit breaker on success
      this.cacheService.resetCircuitBreaker(workflowId);

      return webhookUrl;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to refresh webhook URL for workflow ${workflowId} after ${duration}ms: ${error.message}`,
        error.stack
      );
      return null;
    }
  }

  /**
   * Resolve base URL from environment variables with priority
   * Priority: N8N_WEBHOOK_URL > N8N_PUBLIC_URL > N8N_API_URL (stripped)
   */
  resolveBaseUrl(): string {
    // Check environment variables in priority order
    const webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
    if (webhookUrl) {
      return this.cleanUrl(webhookUrl);
    }

    const publicUrl = this.configService.get<string>('N8N_PUBLIC_URL');
    if (publicUrl) {
      return this.cleanUrl(publicUrl);
    }

    const apiUrl = this.configService.get<string>('N8N_API_URL');
    if (apiUrl) {
      // Strip /api/v1 or /api from the end
      const cleaned = apiUrl.replace(/\/?api(?:\/v\d+)?$/, '');
      return this.cleanUrl(cleaned);
    }

    this.logger.warn('No n8n base URL configured in environment variables');
    return '';
  }

  /**
   * Clean and normalize URL
   */
  private cleanUrl(url: string): string {
    // Remove trailing slashes
    let cleaned = url.replace(/\/$/, '');
    
    // Ensure proper protocol
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }
    
    return cleaned;
  }

  /**
   * Batch refresh webhook URLs for multiple workflows
   * Useful for periodic refresh jobs
   */
  async batchRefreshWebhookUrls(workflowIds: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    
    this.logger.log(`Starting batch refresh for ${workflowIds.length} workflows`);
    
    // Process in parallel with Promise.allSettled to handle failures gracefully
    const promises = workflowIds.map(async (workflowId) => {
      const url = await this.refreshWebhookUrl(workflowId);
      results.set(workflowId, url);
    });

    await Promise.allSettled(promises);
    
    const successCount = Array.from(results.values()).filter(url => url !== null).length;
    this.logger.log(
      `Batch refresh completed: ${successCount}/${workflowIds.length} successful`
    );
    
    return results;
  }

  /**
   * Get webhook URL with three-layer caching
   * This is the primary method for retrieving webhook URLs
   * @param workflowId - The workflow ID
   * @param isVoiceWorkflow - Whether this is a voice workflow (affects caching strategy)
   */
  async getWebhookUrl(workflowId: string, isVoiceWorkflow: boolean = false): Promise<string | null> {
    const startTime = Date.now();

    try {
      // Try to get from cache first
      const cachedUrl = await this.cacheService.getWebhookUrl(workflowId, isVoiceWorkflow);
      if (cachedUrl) {
        const duration = Date.now() - startTime;
        if (isVoiceWorkflow && duration > 10) {
          this.logger.warn(
            `Voice workflow cache hit exceeded latency threshold: ${duration}ms (target < 10ms)`
          );
        }
        return cachedUrl;
      }

      // Cache miss - query database
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { n8nWorkflow: true },
      });

      const webhookUrl = workflow?.n8nWorkflow?.webhookUrl || null;

      if (webhookUrl) {
        // Populate cache
        await this.cacheService.setWebhookUrl(workflowId, webhookUrl, isVoiceWorkflow);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Webhook URL retrieved from database for ${workflowId} in ${duration}ms`
      );

      // Log warning if exceeded voice threshold
      if (isVoiceWorkflow && duration > 300) {
        this.logger.warn(
          `Voice workflow database query exceeded latency threshold: ${duration}ms (target < 300ms)`
        );
      }

      return webhookUrl;
    } catch (error) {
      this.logger.error(
        `Failed to get webhook URL for workflow ${workflowId}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Get webhook URL from database only (bypasses cache)
   * Use this for admin/debug purposes only
   */
  async getWebhookUrlDirect(workflowId: string): Promise<string | null> {
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { n8nWorkflow: true },
      });

      return workflow?.n8nWorkflow?.webhookUrl || null;
    } catch (error) {
      this.logger.error(
        `Failed to get webhook URL directly for workflow ${workflowId}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Determine if a workflow is voice-enabled
   * @param workflowId - The workflow ID to check
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
   * Validate if webhook URL needs refresh based on lastValidatedAt
   * @param workflowId - The workflow ID to check
   * @param maxAgeMinutes - Maximum age in minutes before refresh is needed
   */
  async needsRefresh(workflowId: string, maxAgeMinutes: number = 60): Promise<boolean> {
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { n8nWorkflow: true },
      });

      if (!workflow?.n8nWorkflow) {
        return true; // No workflow found, needs refresh
      }

      if (!workflow.n8nWorkflow.webhookUrl) {
        return true; // No webhook URL, needs refresh
      }

      const lastValidated = workflow.n8nWorkflow.lastValidatedAt;
      if (!lastValidated) {
        return true; // Never validated, needs refresh
      }

      const ageMinutes = (Date.now() - lastValidated.getTime()) / (1000 * 60);
      return ageMinutes > maxAgeMinutes;
    } catch (error) {
      this.logger.error(
        `Failed to check refresh status for workflow ${workflowId}: ${error.message}`
      );
      return true; // On error, assume refresh is needed
    }
  }
}
