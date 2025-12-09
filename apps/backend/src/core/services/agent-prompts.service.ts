import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AgentPrompts, AgentPromptsProvider } from '@jibu/payload-builder';

@Injectable()
export class AgentPromptsService implements AgentPromptsProvider {
  private readonly logger = new Logger(AgentPromptsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAgentPrompts(workflowId: string): Promise<AgentPrompts> {
    if (!workflowId) {
      return { systemPrompt: '', systemMessage: '' };
    }

    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          agent: {
            include: {
              assistants: true,
            },
          },
        },
      });

      if (!workflow || !workflow.agent) {
        return { systemPrompt: '', systemMessage: '' };
      }

      const agent = workflow.agent as any;
      const assistants = Array.isArray(agent.assistants) ? agent.assistants : [];
      const primaryAssistant = assistants[0] as any | undefined;

      let systemPrompt = '';
      let systemMessage = '';

      if (primaryAssistant && typeof primaryAssistant.systemPrompt === 'string') {
        systemPrompt = primaryAssistant.systemPrompt;
      } else if (agent.metadata) {
        const metadata = agent.metadata as any;
        if (metadata && typeof metadata.systemPrompt === 'string') {
          systemPrompt = metadata.systemPrompt;
        }
      } else if (typeof agent.voicemailMessage === 'string') {
        systemPrompt = agent.voicemailMessage;
      }

      if (typeof agent.firstMessage === 'string') {
        systemMessage = agent.firstMessage;
      }

      return {
        systemPrompt,
        systemMessage,
      };
    } catch (error) {
      this.logger.error(
        `Failed to load agent prompts for workflow ${workflowId}: ${(error as Error).message}`,
      );
      return { systemPrompt: '', systemMessage: '' };
    }
  }
}
