# Deprecated / shelved components

As part of the single-brain, multichannel refactor (Option B), the LLM now lives
in the runtime: NestJS (`AgentRuntimeService`) for text/WhatsApp and the LiveKit
Python agent for voice. n8n is no longer the conversational brain — it is only an
optional per-tool integration backend invoked by `ToolExecutorService`.

## Removed (2026-09-22 cleanup)

The items below were confirmed to have **zero references** anywhere in the
codebase (no imports, no nav links, no routable Next.js `page.tsx` under
`app/`) and were deleted outright rather than left in the tree. The decision to
build self-serve agent config as an expanded form (not a revived visual
workflow builder — see `implementation_plan.md` Phase D) confirmed these were
safe to remove rather than "possible re-enablement":

| Component | Former location | Why it was dead |
|-----------|------------------|------------------|
| Committed build output | `apps/worker/dist/` (139 files) | Already `.gitignore`d; should never have been committed; referenced already-deleted n8n processors. |
| n8n orchestrator lib | `libs/n8n-orchestrator` | Zero imports anywhere in the repo. |
| Old agent-builder UI tree | `apps/frontend/src/app/(dashboard)/agent/[agentId]/*` (cms, canvas, evaluations, interfaces, playground, transcripts, settings) | Not linked from any nav; superseded by `workspace/[workspaceId]/agents`. |
| Old top-level routes | `apps/frontend/src/app/(dashboard)/{assistants,voices,n8n-management}` | Predate workspace-scoped routing; zero `href` references anywhere. |
| ReactFlow canvas | `libs/shadcn-ui/.../agent/canvas/*`, `CanvasSidebar.tsx`, `AgentDesigner.tsx` | Already feature-flagged off; zero references outside itself once the old agent-builder tree was removed. |
| Orphaned agent/assistant component libs | `libs/shadcn-ui/src/components/agent/`, `libs/shadcn-ui/src/components/assistants/` | Backed only the deleted old agent-builder tree; zero external references. |
| Non-routable legacy tree | `apps/frontend/src/components/agents/[id]/cms/*` | `page.tsx`/`layout.tsx` files living outside `src/app/` — Next.js App Router never routed to these regardless of links. |

## Still deprecated (kept, not deleted)

These remain **intentionally** in the tree — not dead code in the same sense as
above, either because they're still reachable/registered, or because deleting
them touches data or live traffic and needs a separate explicit decision:

| Component | Location | Status |
|-----------|----------|--------|
| Twilio webhook voice pipeline | `apps/backend/src/modules/voice/*` | Still registered in `app.module.ts`; functionally a no-op today (requires a `workflowId` nothing sets), but not deleted without confirming no live Twilio number still points at it. |
| Workflow versioning | `Workflow` / `WorkflowVersion` tables | Deprecated for agent editing; kept for data history — no destructive migration without explicit sign-off. |
| `Assistant` / `AssistantTool` / `AssistantKnowledgeBase` tables | `schema.prisma` | Superseded by `Agent`/`AgentTool`/`AgentKnowledgeBase`; kept for data history, same reason as above. |

## Replacement

- **Agent editing**: the config form at `apps/frontend/.../agent/[agentId]/config`
  (provider/model + system prompt + knowledge bases + tools + voice + channels),
  wired to `GET/PUT /v1/agents/:id/config`.
- **Brain**: `apps/backend/src/integrations/agent/agent-runtime.service.ts`
  (`runTurn({ agentId, channel, sessionId, input, workspaceId })`).
- **Tools**: `apps/backend/src/integrations/agent/tool-executor.service.ts`
  (function-calling; n8n workflows callable here as a single tool, never as the brain).

## Data model

`Assistant`, `AssistantTool`, `AssistantKnowledgeBase`, `Workflow`, and
`N8nWorkflow` tables remain in `schema.prisma` (no destructive migration). The
runtime reads `Agent` + `AgentTool` + `AgentKnowledgeBase` as the single source
of truth.
