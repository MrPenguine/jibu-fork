/**
 * Backfill script: copy existing Assistant tool/KB links onto the owning Agent.
 *
 * The single-brain runtime reads tools/KBs from `AgentTool` / `AgentKnowledgeBase`
 * (Agent is the source of truth). Historically these links lived on `Assistant`
 * via `AssistantTool` / `AssistantKnowledgeBase`. This script mirrors them onto
 * the corresponding Agent (`Assistant.agentId`) so existing agents keep working.
 *
 * Idempotent: uses upsert-style skipDuplicates and unique constraints.
 *
 * Run with:
 *   DATABASE_URL=... npx ts-node apps/backend/prisma/backfill-agent-links.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const assistants = await prisma.assistant.findMany({
    select: {
      id: true,
      agentId: true,
      tools: { select: { toolId: true, config: true } },
      knowledgeBases: { select: { knowledgeBaseId: true } },
    },
  });

  let toolLinks = 0;
  let kbLinks = 0;

  for (const a of assistants) {
    if (!a.agentId) continue;

    if (a.tools.length) {
      const res = await prisma.agentTool.createMany({
        data: a.tools.map((t) => ({
          agentId: a.agentId,
          toolId: t.toolId,
          config: t.config ?? undefined,
        })),
        skipDuplicates: true,
      });
      toolLinks += res.count;
    }

    if (a.knowledgeBases.length) {
      const res = await prisma.agentKnowledgeBase.createMany({
        data: a.knowledgeBases.map((k) => ({
          agentId: a.agentId,
          knowledgeBaseId: k.knowledgeBaseId,
        })),
        skipDuplicates: true,
      });
      kbLinks += res.count;
    }
  }

  console.log(
    `Backfill complete. Created ${toolLinks} AgentTool and ${kbLinks} AgentKnowledgeBase links across ${assistants.length} assistants.`,
  );
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
