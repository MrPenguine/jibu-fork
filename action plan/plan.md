# n8n Orchestrator: Async Publish and Execute – MVP Plan

## Scope (MVP)
- Webhook → AI Agent → Provider Model (Gemini, Anthropic, OpenAI).
- Compile internal WorkflowJSON + Assistant config into n8n-compatible JSON using shared templates in `libs/n8n-orchestrator/templates/`.
- Persist compiled n8n JSON into DB (`N8nWorkflow.workflowJson`) before publish.
- Async publish pipeline (worker) replaces/updates the specific n8n workflow (`Workflow.n8nWorkflowId`) or creates it if missing.
- Execution remains async via existing `workflow-execution` queue.

## Key Directories
- Shared orchestrator lib: `libs/n8n-orchestrator/`
  - Templates: `libs/n8n-orchestrator/templates/`
  - (To add) Compiler/Mapping/Registry/Diff in `libs/n8n-orchestrator/`
- Worker: `apps/worker/`
  - Existing: `src/n8n/` for execution
  - (To add) `src/n8n/publish-workflow.processor.ts` for publish
- Backend: `apps/backend/`
  - Thin API to enqueue publish; preview compile; webhook controller for verification

## Data Models Used (already present)
- `Workflow` with `n8nWorkflowId?: string` and pointers to `WorkflowVersion`
- `WorkflowVersion` with `workflowJson` and `status`
- `Assistant` with `llmProvider`, `llmModel`, `systemPrompt`
- `N8nWorkflow` with `n8nWorkflowId`, `workflowJson`, `isActive`, `webhookUrl`, `lastValidatedAt`

## Templates (existing and missing)
- Existing: `webhook.template.ts`, `chat-trigger.template.ts`, `ai-agent.template.ts`, `google-gemini.template.ts`, `respond-to-webhook.template.ts`
- Missing (to add now): `anthropic.template.ts`, `openai.template.ts`

## Async Publish Flow (final)
1) API: Publish requested
   - Load `Workflow` + effective `WorkflowVersion.workflowJson` + `Assistant`.
   - Compile to n8n JSON (shared lib) – Webhook, AI Agent, Provider Model.
   - Persist compiled JSON to `N8nWorkflow.workflowJson` (create/update) and compute content hash.
   - Enqueue `PUBLISH_WORKFLOW` job with `{ workflowId, workspaceId, n8nWorkflowDbId, n8nWorkflowId?, hash, activate? }`.
   - Return 202 + `jobId`.
2) Worker: `PUBLISH_WORKFLOW` processor
   - Acquire distributed lock on `workflowId`.
   - Read compiled JSON from `N8nWorkflow`.
   - If `Workflow.n8nWorkflowId` exists → update/replace that workflow in n8n (no-op if hash unchanged unless `force`).
   - Else → create workflow in n8n and persist returned id.
   - Activate per policy (auto-activate in dev; explicit in prod).
   - Persist `n8nWorkflowId`, `isActive`, `webhookUrl`, `hash`, `lastValidatedAt`.
   - Release lock; mark job done.

## Async Execute Flow (unchanged)
- Use `workflow-execution` queue with `N8nWorkflowProcessor` to start/check/stop n8n executions.
- Optional callback URL for completion/failure notifications.

## Mapping Rules (MVP)
- Start → Standard Webhook node (`n8n-nodes-base.webhook`).
- Assistant → AI Agent node (`@n8n/n8n-nodes-langchain.agent`).
- Provider Model node per Assistant’s `llmProvider`:
  - Gemini → `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` (param key: `modelName`, creds key: `googlePalmApi`).
  - Anthropic → `@n8n/n8n-nodes-langchain.lmChatAnthropic` (param key: `model`, creds key: `anthropicApi`).
  - OpenAI → `@n8n/n8n-nodes-langchain.lmChatOpenAi` (param key: `model`, creds key: `openAiApi`).
- Connections:
  - `Webhook` (main) → `AI Agent`.
  - `<Provider Model>` (ai_languageModel) → `AI Agent`.
- Deterministic node names/ids; deterministic webhook path/id.

## Security and Webhooks
- Deterministic path: `/api/n8n/hooks/{workflowId}/{version}`.
- HMAC signature per workflow; backend webhook controller verifies.

## Idempotency and Drift
- Content hash of compiled JSON stored in `N8nWorkflow`.
- Skip updates when hash unchanged (unless `force`).
- Optional periodic reconciler to detect drift vs live n8n JSON.

## Status and UX
- Publish status endpoint returns job state + DB snapshot (`isActive`, `n8nWorkflowId`, `hash`).
- Preview compile endpoint returns compiled n8n JSON and hash (no push).

## Immediate Tasks
- Add missing templates: Anthropic and OpenAI (in `libs/n8n-orchestrator/templates/`).
- Add Model Name Registry (provider → node type, param keys, creds keys, model normalization).
- Add Template Compiler, Node Mapping, (optional) Diff in shared lib.
- Add Worker Publish queue + processor.
- Add Backend endpoints: publish (enqueue), status, preview compile; webhook controller with HMAC verification.

## Acceptance (MVP)
- Publish Gemini/Anthropic/OpenAI flows results in correct nodes, parameters, and connections in n8n.
- Updates replace the specific n8n workflow id if already linked; new creations link back to `Workflow`.
- Activation policy honored; webhook functional and verified.
