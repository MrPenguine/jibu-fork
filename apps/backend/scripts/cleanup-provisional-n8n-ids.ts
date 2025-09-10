#!/usr/bin/env ts-node
/**
 * One-off migration: Null out any provisional n8n IDs that were set by the backend.
 * - Clears Workflow.n8nWorkflowId where it starts with 'provisional:'
 * - Clears N8nWorkflow.n8nWorkflowId where it starts with 'provisional:'
 *
 * Usage:
 *   pnpm ts-node apps/backend/scripts/cleanup-provisional-n8n-ids.ts
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const res1 = await prisma.$executeRawUnsafe(
      `UPDATE "Workflow" SET "n8nWorkflowId" = NULL WHERE "n8nWorkflowId" LIKE 'provisional:%';`,
    );
    const res2 = await prisma.$executeRawUnsafe(
      `UPDATE "N8nWorkflow" SET "n8nWorkflowId" = NULL WHERE "n8nWorkflowId" LIKE 'provisional:%';`,
    );

    console.log('Cleanup complete:', { workflowCleared: res1, n8nWorkflowCleared: res2 });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
