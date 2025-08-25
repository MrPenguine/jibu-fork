# Plan 3: Implementation Steps, Migration, and Testing

Goal: Implement the Agent-centric schema with workflow versioning, switch the app to unified JSON stored in `WorkflowVersion.workflowJson`, and provide a safe rollout and testing plan.

## Phased Implementation

- __Phase A — Schema & Prisma__
  1) Update Prisma schema:
     - Add Agent default fields: `llmProvider?`, `llmModel?`, `ttsProvider?`, `ttsVoiceId?`, `sttProvider?`, `sttModel?` (Strings for now; enums can be added later).
     - New model `WorkflowVersion` with fields: `id`, `createdAt`, `updatedAt`, `workflowId`, `version`, `workflowJson Json`, `status`, `publishedAt`, relations for published/draft pointers.
     - Update `Workflow` to remove inline `workflowJson` storage; add `publishedVersionId?`, `draftVersionId?`, and `versions` relation.
     - Keep `isPrimary` on `Workflow`; add reverse relation on `Agent` for `primaryWorkflow` and `primaryWorkflowId?`.
  2) Run `prisma migrate dev` in development.

- __Phase B — Backend Services & Controllers__
  1) Create/Update Workflow:
     - `POST /workflows/agent/:agentId`: create Workflow (logical), create initial WorkflowVersion (version=1, status=draft) with incoming unified JSON. If `isPrimary` requested, set on Workflow and connect Agent.primaryWorkflowId.
     - `PUT /workflows/:workflowId/versions/:version`: update draft version only (autosave). Reject updates to published versions.
     - `GET /workflows/:workflowId`: return Workflow metadata with pointers to `publishedVersionId` and `draftVersionId`.
     - `GET /workflows/:workflowId/versions/:version`: return that version’s `workflowJson`.
  2) Publish:
     - `POST /workflows/:workflowId/versions/:version/publish`:
       - Validate the JSON (structure, required fields, reachability, handle semantics).
       - Mark the version `status=published`, set `publishedAt`.
       - Set `publishedVersionId` pointer on Workflow.
       - Create a new draft version by cloning JSON with `version+1`, `status=draft`; set `draftVersionId`.
  3) Execution compile-time:
     - When executing a workflow, resolve effective LLM/TTS/STT using Agent defaults + node overrides (no workflow-level defaults).

- __Phase C — Frontend Integration__
  1) Types:
     - Add `UnifiedWorkflow` (logical) and `WorkflowVersion` (version payload) types.
  2) Hooks:
     - Refactor `useWorkflow.ts` to load the current draft version JSON via `GET /workflows/:workflowId/versions/:version`.
     - Autosave the entire JSON to the draft via `PUT /workflows/:workflowId/versions/:version` (debounced).
  3) Publish UX:
     - Call publish endpoint; on success, reload metadata to get the new published pointer and new draft version.
     - Lock published versions as read-only; continue editing the new draft.
  4) Assistant Inspector:
     - Show `inheritModel` toggle. When true, display “default (from agent)” placeholder; hide model fields. When false, show editable override.

## Data Migration Plan

- __Inputs:__ current `Workflow` table with inline `workflowJson`, `version`, `isPublished`, `publishedAt`, `workflowType`, and links (`agentId`, etc.).
- __Steps:__
  1) Create `WorkflowVersion` table.
  2) For each existing `Workflow` row:
     - Create one `WorkflowVersion` with:
       - `workflowId = workflow.id`
       - `version = workflow.version` (or 1 if absent)
       - `workflowJson = workflow.workflowJson`
       - `status = (workflow.isPublished ? "published" : "draft")`
       - `publishedAt = workflow.publishedAt`
     - On the parent `Workflow`:
       - If `isPublished = true`: set `publishedVersionId` to the created version; create a new draft version by cloning JSON with `version+1`, set `draftVersionId`.
       - Else: set `draftVersionId` to the created version.
  3) Drop `Workflow.workflowJson`, `Workflow.isPublished`, `Workflow.publishedAt`, and (optionally) `Workflow.version` after migration completes and all code paths are switched.
  4) Ensure `Agent.primaryWorkflowId` is set for agents that have a single main workflow.

## Validation Checklist (Server-Side)

- __Graph integrity__
  - Exactly one START node
  - All edges reference valid nodes
  - No unreachable non-Note nodes from START
- __Node requirements__
  - API_CALL: `url`, `method`
  - TOOL_CALL: `toolId`
  - LISTEN: `variableName`
  - CONDITION: `operator` and relevant `value` except unary checks (isSet/isNotSet)
  - ASSISTANT: `inheritModel` present; if `false`, `data.model.provider` and `data.model.model` required
- __Handles__
  - CONDITION edges use `sourceHandle` of `true` or `false`

## Testing Plan

- __Unit tests (backend)__
  - Validate publish rules for each node type.
  - Versioning transitions: draft -> published -> new draft.
  - Execution config resolution merges Agent defaults with node overrides.
- __Integration tests__
  - Create workflow -> save draft JSON -> publish -> ensure pointers updated -> new draft created.
  - Ensure `GET /workflows/:id` and `GET /workflows/:id/versions/:v` return expected shapes.
- __Frontend e2e checks__
  - Load editor with draft version.
  - Autosave debounce works; server receives unified JSON.
  - Publish shows validation errors inline; successful publish creates new draft.

## Rollout/Operational

- __Feature flag__ (optional): enable versioned API routes behind an env flag until migration completes.
- __Observability__:
  - Add logs/metrics for publish validations and save failures.
  - Track save duration and publish duration.
- __Backups__:
  - Backup existing `Workflow` table prior to migration.

## Acceptance Criteria

- All workflows persist via `WorkflowVersion.workflowJson` only.
- Agent holds all default LLM/TTS/STT settings; workflow JSON only holds overrides.
- Publish workflow is server-validated and creates a new draft on success.
- Frontend operates against draft versions with autosave and proper publish UX.
