# Deprecated / shelved components

As part of the single-brain, multichannel refactor (Option B), the LLM now lives
in the runtime: NestJS (`AgentRuntimeService`) for text/WhatsApp and the LiveKit
Python agent for voice. n8n is no longer the conversational brain — it is only an
optional per-tool integration backend invoked by `ToolExecutorService`.

The following are **deprecated**. They are intentionally left in the tree (not
deleted) for backward compatibility and possible re-enablement, but are removed
from the default runtime and agent setup flow.

| Component | Location | Status |
|-----------|----------|--------|
| n8n orchestrator lib | `libs/n8n-orchestrator` | Deprecated — not in conversational path. Only reachable as a tool. |
| Compile-context builder | `libs/n8n-orchestrator/.../compile-context.builder*` | Deprecated — graph compilation no longer used at runtime. |
| Publish-workflow processor | `apps/worker` publish-workflow.processor | Deprecated — workflow publishing not part of agent config flow. |
| Workflow versioning | `Workflow` / `WorkflowVersion` flows | Deprecated for agent editing; kept for data history. |
| ReactFlow canvas (agent editor) | `apps/frontend/.../agent/[agentId]/canvas/*`, `libs/shadcn-ui/.../agent/canvas/*`, `AgentDesigner.tsx` | Feature-flagged. Hidden by default; set `NEXT_PUBLIC_ENABLE_CANVAS=true` to re-enable the "Canvas (beta)" nav item. |

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
