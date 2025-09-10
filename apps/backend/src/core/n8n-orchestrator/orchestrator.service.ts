import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CompileContextBuilder } from './compile-context.builder';
import { compileFromInternalGraph } from '../../../../../libs/n8n-orchestrator/node-mapping.service';
import { CompileContext, InternalGraph } from '../../../../../libs/n8n-orchestrator/adapter-registry';
import { createHash } from 'crypto';

function computeHash(obj: unknown): string {
  const json = JSON.stringify(obj);
  return createHash('sha256').update(json).digest('hex');
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctxBuilder: CompileContextBuilder,
  ) {}

  /**
   * Compile the internal WorkflowJSON to n8n JSON and persist into N8nWorkflow.workflowJson.
   * Returns compiled workflow JSON, hash, and the linked N8nWorkflow DB id.
   */
  async compileAndPersist(workflowId: string, workspaceId: string) {
    const { ctx, graph } = await this.ctxBuilder.build(workflowId, workspaceId);

    // Compile to n8n JSON
    const compiled = compileFromInternalGraph(graph, ctx);
    // Log the compiled payload (trim if huge)
    try {
      const json = JSON.stringify(compiled);
      const preview = json.length > 5000 ? json.slice(0, 5000) + '...<truncated>' : json;
      this.logger.debug(`Compiled n8n workflow JSON (backend): ${preview}`);
    } catch {}
    const hash = computeHash(compiled);

    // Ensure we have an N8nWorkflow row linked to this workflow (local only; no n8n id here)
    let n8nWorkflowRow = await this.prisma.n8nWorkflow.findFirst({
      where: { workflows: { some: { id: workflowId } } },
      select: { id: true },
    });

    if (n8nWorkflowRow) {
      await this.prisma.n8nWorkflow.update({
        where: { id: n8nWorkflowRow.id },
        data: {
          workflowJson: compiled as any,
          lastValidatedAt: new Date(),
        },
        select: { id: true },
      });
    } else {
      n8nWorkflowRow = await this.prisma.n8nWorkflow.create({
        data: {
          workflowJson: compiled as any,
          isActive: false,
          lastValidatedAt: new Date(),
          workspace: { connect: { id: workspaceId } },
        },
        select: { id: true },
      });
      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: { n8nWorkflow: { connect: { id: n8nWorkflowRow.id } } },
      });
    }

    return {
      n8nWorkflowDbId: n8nWorkflowRow.id,
      hash,
      compiled,
    };
  }
}
