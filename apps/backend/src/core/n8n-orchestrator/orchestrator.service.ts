import { Injectable } from '@nestjs/common';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctxBuilder: CompileContextBuilder,
  ) {}

  /**
   * Compile the internal WorkflowJSON to n8n JSON and persist into N8nWorkflow.workflowJson.
   * Returns compiled workflow JSON, hash, and the linked N8nWorkflow DB id.
   */
  async compileAndPersist(workflowId: string, workspaceId: string) {
    const { ctx, graph, n8nWorkflowId: linkedN8nWorkflowId } = await this.ctxBuilder.build(workflowId, workspaceId);

    // Compile to n8n JSON
    const compiled = compileFromInternalGraph(graph, ctx);
    const hash = computeHash(compiled);

    // Ensure we have an N8nWorkflow row linked to this workflow
    let n8nWorkflowRow = null as null | { id: string };

    if (linkedN8nWorkflowId) {
      // Update existing
      n8nWorkflowRow = await this.prisma.n8nWorkflow.update({
        where: { id: linkedN8nWorkflowId },
        data: {
          workflowJson: compiled as any,
          lastValidatedAt: new Date(),
        },
        select: { id: true },
      });
    } else {
      // Create and link to workflow
      n8nWorkflowRow = await this.prisma.n8nWorkflow.create({
        data: {
          // Provisional ID until we push to n8n and receive a real workflow id
          n8nWorkflowId: `provisional:${workflowId}`,
          workflowJson: compiled as any,
          isActive: false,
          lastValidatedAt: new Date(),
          workspace: { connect: { id: workspaceId } },
        },
        select: { id: true },
      });

      // Link from workflow to this N8nWorkflow row
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
