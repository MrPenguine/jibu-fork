import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AgentPrompts, AgentPromptsProvider } from '@jibu/payload-builder';

/**
 * Workflow-scoped prompt lookup for the legacy payload builder. Workflows no
 * longer exist in the schema, so there is nothing to resolve; agent prompts
 * are supplied by the single-brain runtime instead.
 */
@Injectable()
export class AgentPromptsService implements AgentPromptsProvider {
  private readonly logger = new Logger(AgentPromptsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAgentPrompts(workflowId: string): Promise<AgentPrompts> {
    if (workflowId) {
      this.logger.debug(`No workflow-scoped prompts available for ${workflowId}`);
    }
    return { systemPrompt: '', systemMessage: '' };
  }
}
