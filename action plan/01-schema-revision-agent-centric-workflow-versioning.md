# Plan 1: Schema Revision — Agent-Centric With Workflow Versioning

Goal: Model agents as the parent container with defaults, and keep workflows as logical containers that own immutable versions storing the unified workflow JSON.

## Models

- __Agent__
  - Identity: `id`, timestamps, `name`, optional `description`
  - Ownership: `workspaceId -> Workspace`, optional `folderId -> Folder`
  - Defaults (DB-level, not in workflow JSON):
    - `llmProvider: String?` (e.g., "openai", "anthropic")
    - `llmModel: String?` (e.g., "gpt-4o-mini", "claude-3.5-sonnet")
    - `ttsProvider: String?` (e.g., "elevenlabs", "openai")
    - `ttsVoiceId: String?`
    - `sttProvider: String?` (e.g., "deepgram", "whisper")
    - `sttModel: String?`
  - Primary workflow link (fast access):
    - `primaryWorkflowId: String? @unique`
    - `primaryWorkflow: Workflow? @relation("PrimaryAgentWorkflow", fields: [primaryWorkflowId], references: [id], onDelete: SetNull)`
  - Relations: `workflows`, `chats`, `sessions`, `apiKeys`

- __Workflow__ (logical container)
  - Identity: `id`, timestamps, `name`, optional `description`
  - Ownership: `agentId -> Agent`
  - Primary flag: `isPrimary: Boolean @default(false)`
  - Versioning pointers for fast reads:
    - `publishedVersionId: String? @unique`
    - `publishedVersion: WorkflowVersion? @relation("PublishedWorkflowVersion", fields: [publishedVersionId], references: [id], onDelete: SetNull)`
    - `draftVersionId: String? @unique`
    - `draftVersion: WorkflowVersion? @relation("DraftWorkflowVersion", fields: [draftVersionId], references: [id], onDelete: SetNull)`
  - All versions: `versions: WorkflowVersion[]`
  - Reverse link from Agent: `agentAsPrimary: Agent? @relation("PrimaryAgentWorkflow")`

- __WorkflowVersion__ (immutable snapshot)
  - Identity: `id`, timestamps
  - Parent link: `workflowId -> Workflow`
  - `version: Int` (unique per workflow)
  - `workflowJson: Json` (entire unified JSON for this version)
  - Status: `status: String @default("draft")` ("draft" | "published" | "archived")
  - `publishedAt: DateTime?`
  - Back-links to Workflow pointers:
    - `workflowAsPublishedVersion: Workflow? @relation("PublishedWorkflowVersion")`
    - `workflowAsDraftVersion: Workflow? @relation("DraftWorkflowVersion")`
  - Constraints: `@@unique([workflowId, version])`, `@@index([workflowId])`

## Notes
- Agent-level defaults (TTS/STT/LLM) live in Agent. They are not duplicated in `workflowJson`.
- `workflowJson` only contains overrides (e.g., Assistant node `inheritModel=false`).
- Use published/draft pointers on `Workflow` to avoid scanning `versions` on hot paths.

## Migration Outline
- Create new `WorkflowVersion` table.
- Move any existing `Workflow.workflowJson` into a first version (v1) per `Workflow`.
- For primary workflows: set `Agent.primaryWorkflowId` to the appropriate `Workflow`.
- Initialize `publishedVersionId` and/or `draftVersionId` as needed.

## API Impact
- `GET /workflows/:id` returns the `Workflow` with pointers and minimal metadata; separate endpoint `GET /workflows/:id/versions/:version` returns a specific version’s JSON.
- Editing happens against the current draft version; publishing creates/marks a published version and increments version numbers.

## Concrete Prisma Edit Instructions

- __Add new model `WorkflowVersion`__ (place near `Workflow`):

```prisma
model WorkflowVersion {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workflowId  String
  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  version     Int
  workflowJson Json

  status      String   @default("draft") // "draft" | "published" | "archived"
  publishedAt DateTime?

  // Back-links for pointers
  workflowAsPublishedVersion Workflow? @relation("PublishedWorkflowVersion")
  workflowAsDraftVersion     Workflow? @relation("DraftWorkflowVersion")

  @@unique([workflowId, version])
  @@index([workflowId])
}
```

- __Update `Workflow` model__ (keep legacy fields for migration; add pointers and relation):

```prisma
model Workflow {
  id                 String       @id @default(uuid())
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  name               String
  description        String?
  // legacy fields to KEEP for migration step
  workflowJson       Json
  isPrimary          Boolean      @default(false)
  agentId            String
  workspaceId        String?
  version            Int          @default(1)
  isPublished        Boolean      @default(false)
  publishedAt        DateTime?
  workflowType       WorkflowType @default(MASTER)
  masterWorkflowId   String?
  masterWorkflow     Workflow?    @relation("SecondaryWorkflows", fields: [masterWorkflowId], references: [id], onDelete: Cascade)
  secondaryWorkflows Workflow[]   @relation("SecondaryWorkflows")
  n8nWorkflowId      String?
  n8nWorkflow        N8nWorkflow? @relation(fields: [n8nWorkflowId], references: [id], onDelete: SetNull)

  agent              Agent        @relation(fields: [agentId], references: [id], onDelete: Cascade)
  workspace          Workspace?   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  chats              Chat[]

  // NEW: versioning pointers and relation
  publishedVersionId String?      @unique
  publishedVersion   WorkflowVersion? @relation("PublishedWorkflowVersion", fields: [publishedVersionId], references: [id], onDelete: SetNull)

  draftVersionId     String?      @unique
  draftVersion       WorkflowVersion? @relation("DraftWorkflowVersion", fields: [draftVersionId], references: [id], onDelete: SetNull)

  versions           WorkflowVersion[]

  // NEW: reverse link from Agent.primaryWorkflow
  agentAsPrimary     Agent?       @relation("PrimaryAgentWorkflow")

  @@index([agentId])
}
```

- __Update `Agent` model__ (add defaults and primary workflow pointer; retain existing fields):

```prisma
model Agent {
  id          String    @id @default(uuid())
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  name        String
  description String?
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  folderId    String?
  folder      Folder?   @relation(fields: [folderId], references: [id])

  // --- Agent-level default settings (NEW) ---
  llmProvider String?   // e.g., "openai", "anthropic"
  llmModel    String?   // e.g., "gpt-4o-mini", "claude-3.5-sonnet"
  ttsProvider String?   // e.g., "elevenlabs", "openai"
  ttsVoiceId  String?   // e.g., "alloy"
  sttProvider String?   // e.g., "deepgram", "whisper"
  sttModel    String?   // e.g., "nova-2"

  // --- Primary Workflow Link (NEW) ---
  primaryWorkflowId String?   @unique
  primaryWorkflow   Workflow? @relation("PrimaryAgentWorkflow", fields: [primaryWorkflowId], references: [id], onDelete: SetNull)

  // Reverse relations
  workflows  Workflow[]
  chats      Chat[]
  sessions   AgentSession[]
  apiKeys    ApiKey[]

  @@index([workspaceId])
  @@index([folderId])
}
```

### Relation naming and constraints

- Ensure relation names are consistent:
  - `"PublishedWorkflowVersion"` between `Workflow.publishedVersion` and `WorkflowVersion.workflowAsPublishedVersion`.
  - `"DraftWorkflowVersion"` between `Workflow.draftVersion` and `WorkflowVersion.workflowAsDraftVersion`.
  - `"PrimaryAgentWorkflow"` between `Agent.primaryWorkflow` and `Workflow.agentAsPrimary`.
- Keep `@unique` on `publishedVersionId`, `draftVersionId`, and `primaryWorkflowId`.
- Do not drop legacy fields until after data backfill and code refactor.
