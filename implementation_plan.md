# implementation_plan.md

# [Goal] Jibu AI — Enterprise-Grade Voice/Chat Agent Platform

This supersedes the earlier "LiveKit Universal Gateway for n8n Agents" plan. That
architecture (Python agent as a dumb media relay, n8n as the conversational brain,
NestJS as a sync-wrapper queue proxy) was **decided against** and already partially
unwound in code — see `DEPRECATED.md`. Do not resurrect the n8n-gateway pattern.

## 1. Architecture of Record (current, confirmed in code)

**Single-brain, multichannel.** The LLM runs in-process, not in n8n:

- **Text / WhatsApp** → `apps/backend/src/integrations/agent/agent-runtime.service.ts`
  (`runTurn({ agentId, channel, sessionId, input, workspaceId })`)
- **Voice** → `apps/livekit-agent` (Python) joins the LiveKit room directly and calls
  the same backend for LLM turns; it does not proxy through n8n.
- **Tools** → `apps/backend/.../tool-executor.service.ts`. n8n is reachable as *one
  callable tool*, never the brain.
- **Data model**: `Agent` / `AgentTool` / `AgentKnowledgeBase` / `AgentSession` are the
  source of truth. `Assistant` / `AssistantTool` / `AssistantKnowledgeBase` and the
  `Workflow` tables are legacy — read-only history, not used by the runtime.
- **Multi-tenancy**: `Workspace` + `WorkspaceMembership` + `Invitation`, auth via
  Better Auth (`AuthUser`/`AuthSession`/`AuthAccount`), not Clerk.
- **RAG**: `KnowledgeBase` → `KnowledgeBaseSource` → `ChunkMetadata`, indexed into
  Qdrant, with SSE progress via `KnowledgeBaseSourceEvent`.
- **Admin**: `apps/backend/src/modules/admin` (plans, dashboard, analytics, users,
  provider-credentials, audit-logs, subscriptions, workspaces, system-checks) with
  matching pages under `apps/frontend/src/app/admin/*`. This is real and working —
  extend it, don't rebuild it.
- **Ops scaffolding**: docker-compose already wires Postgres, Redis, Qdrant, LiveKit,
  Vault, Prometheus, Grafana, n8n (tool-only), Ollama.

Anyone (human or agent) picking up this repo should treat the above as ground truth
over any Notion doc or older markdown file.

---

## 2. Phase A — Telephony completion

The current voice path can join a LiveKit room and run a turn, but is missing the
pieces an enterprise phone product needs. None of this routes through n8n.

### A1. `PhoneNumber` model (replaces the JSON-buried number)
Add a real table instead of `Agent.metadata.channels.voice.phoneNumber`:

```prisma
model PhoneNumber {
  id           String    @id @default(uuid())
  workspaceId  String
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  number       String    @unique      // E.164
  provider     String                 // "twilio" | "africastalking" | "safaricom_sip" | "airtel_sip"
  sipTrunkId   String?                // LiveKit SIP trunk reference
  agentId      String?
  agent        Agent?    @relation(fields: [agentId], references: [id])
  capabilities String[]  @default([]) // ["voice", "sms"]
  status       String    @default("active") // active | releasing | released
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([workspaceId])
  @@index([agentId])
}
```

Backend: `modules/v1/phone-number` (CRUD + assign-to-agent), wrapping LiveKit's SIP
trunk API so provisioning/connecting/releasing a number is self-service, not a
manual `livekit.yaml` edit. `livekit-agent.service.ts` resolves the agent by
`PhoneNumber.agentId` instead of the JSON path lookup.

### A2. `Call` model (replaces the loose `callSid` string on `AgentSession`)

```prisma
model Call {
  id               String    @id @default(uuid())
  workspaceId      String
  workspace        Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  agentId          String
  agent            Agent     @relation(fields: [agentId], references: [id])
  sessionId        String?
  session          AgentSession? @relation(fields: [sessionId], references: [id])
  phoneNumberId    String?
  contactId        String?              // resolved from fromNumber/toNumber — see A7
  contact          Contact?  @relation(fields: [contactId], references: [id])
  direction        String    // inbound | outbound
  fromNumber       String?
  toNumber         String?
  status           String    // ringing | in-progress | completed | failed | no-answer
  disconnectReason String?
  durationSeconds  Int?
  recordingUrl     String?
  transcript       Json?
  cost             Decimal?  @db.Decimal(10, 4)
  startedAt        DateTime?
  endedAt          DateTime?
  createdAt        DateTime  @default(now())

  @@index([workspaceId])
  @@index([agentId])
  @@index([status])
  @@index([contactId])
}
```

This is what the admin analytics pages and workspace-level call history need — it
doesn't exist today.

### A3. DTMF
Add real handling in the Python agent (`apps/livekit-agent/src/agent/`), not the
deprecated Twilio/n8n `voice.service.ts` path:
- Subscribe to LiveKit's SIP DTMF event on the room.
- Feed digits into `AgentRuntimeService.runTurn` as a distinct input type (`type:
  "dtmf"`), so agent config can branch on it (IVR menus, PIN auth) via normal
  prompt/tool logic — not a separate n8n dispatch.
- Support sending DTMF out (`publish_dtmf`) for agents that need to navigate a
  third-party IVR.

### A4. Call transfer
Cold transfer first (SIP REFER via LiveKit's `perform_transfer`), exposed as a tool
the agent can call (`transfer_to_human`, `transfer_to_number`). Warm transfer
(hold + bridge) is a later iteration once cold transfer is proven.

### A5. Outbound & batch calling
`POST /v1/calls/outbound` (single) and `POST /v1/calls/batch` (CSV upload → queued
via existing worker infra) — create a LiveKit SIP participant per call, same
`AgentRuntimeService` turn loop, logs into the new `Call` table.

### A6. Recording
Enable LiveKit room recording (Egress) for calls where the agent config opts in;
store the resulting URL on `Call.recordingUrl`. Object storage already implied by
the storage integration layer — wire it up rather than adding a new one.

### A7. Contact identity & agent memory
Today nothing persists who a caller/chatter *is* across separate calls/chats —
`AgentSession`/`Chat` are per-conversation, and `Chat.sessionId` is a loose string
("For calls: phone number, For chats: user identifier or anonymous session") with
no table behind it. Without a stable identity, a memory layer would just forget
everyone the moment a session ends. This phase adds that identity, plus the memory
layer built on top of it.

**`Contact` model** — the identity anchor, scoped to a workspace (a business's own
customer, never shared across workspaces):

```prisma
model Contact {
  id          String    @id @default(uuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  externalId  String                 // E.164 phone (calls/WhatsApp) or authenticated widget user id
  channel     String                 // "phone" | "whatsapp" | "widget"
  displayName String?                // learned over time ("my name is Wanjiru")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  calls       Call[]
  chats       Chat[]

  @@unique([workspaceId, externalId])
  @@index([workspaceId])
}
```

`Chat` also gets an optional `contactId` (same relation pattern as `Call.contactId`
in A2), resolved the same way: E.164 phone for calls/WhatsApp, authenticated user
id for the web widget. A caller with neither (anonymous browser session) stays
contact-less — session-scoped only, not persisted as a `Contact`.

**Memory layer (Mem0 + Qdrant)** — one integration point, not one per channel,
because of the architecture already confirmed in §1: `AgentRuntimeService.runTurn()`
(`apps/backend/src/integrations/agent/agent-runtime.service.ts:100`) is the single
brain every channel calls. Memory hooks into `runTurn` itself, not into the Python
LiveKit agent:
- **Read** (start of `runTurn`, before the LLM call): resolve the `Contact` for
  `params.sessionId`/channel, fetch their memory profile from Qdrant, inject into
  the system prompt. Budget: single-digit ms — this is a plain vector lookup, no
  LLM call on the critical path.
- **Write** (after the turn completes): fire-and-forget, off the response path —
  extract new facts via an LLM call and upsert into Qdrant. Same `runTurn` callers
  already await a result before this runs, so it never adds latency to what the
  caller/chatter experiences.

**Tenant isolation**: one Qdrant collection **per workspace**
(`agent_memories_${workspaceId}`), not a shared collection with metadata filtering.
This mirrors the existing, proven pattern for KB embeddings
(`kb_${knowledgeBaseId}` in `knowledge-base.service.ts` / `indexing.processor.ts`)
via the same `VectorDbService.ensureCollection`. A missed filter in a shared
collection would leak one business's customer data into another's — collection-
per-workspace makes that structurally impossible rather than relying on query
discipline. Mem0's own `user_id` (→ `Contact.id`) scoping then applies *inside*
that already-isolated collection as a second layer, not the only one.

**Model defaults**: Mem0's own extraction LLM/embedder default to whatever's
available locally via Ollama (matches the RAG-model-defaults-to-local pattern
already in the Agent Config page), per-workspace overridable — not hardcoded to a
paid API.

**DTMF/memory share a choke point**: A3's plan to feed DTMF into `runTurn` as a
distinct input type means IVR/PIN-auth state and conversational memory both flow
through the identical function — no separate dispatch path to keep in sync.

---

## 3. Phase B — Enterprise hardening

These are independent of telephony and should land in parallel, not after:

- **CI**: GitHub Actions running lint + typecheck + `nx affected:test` +
  `nx affected:build` on every PR. This is the single highest-leverage change
  given there is currently no CI at all.
- **Security**: `helmet()`, `@nestjs/throttler` on the global pipeline, CORS locked
  to an explicit origin allowlist (currently falls back to `origin: true` when
  `FRONTEND_URL` is unset), gate `/api/docs` (Swagger) behind
  `NODE_ENV !== 'production'`.
- **Tests, targeted not blanket**: auth flows, billing/usage, `AgentRuntimeService`,
  and the new telephony services (A1–A5) first. Five spec files exist today across
  the whole monorepo.
- **Billing wiring**: confirm/complete `Plan`/`Subscription`/`UsageRecord` → Stripe
  webhooks, and meter `Call.durationSeconds` + LLM/STT/TTS usage into
  `UsageRecord` so billing reflects actual telephony cost.
- **Observability**: Prometheus/Grafana containers already exist in
  docker-compose — confirm the backend and livekit-agent actually export metrics,
  add dashboards for call volume/latency/error rate, and wire alerting.
- **Secrets**: confirm Vault (present in docker-compose) is actually the source of
  provider credentials in every environment, not just `.env` files.

---

## 4. Phase C — Admin surface additions

Existing admin pages (`analytics`, `billing`, `credentials`, `logs`, `settings`,
`system-checks`, `users`, `workspaces`) stay as-is. Add, once Phase A models exist:

- **Numbers** (`/admin/numbers`): inventory of every `PhoneNumber` across
  workspaces, SIP trunk health, assign/reassign to agent, release.
- **Live Calls** (`/admin/calls`): active `Call`/`AgentSession` rows, LiveKit room
  state, ability to force-end a stuck call.
- Extend **Analytics** to break out voice-specific metrics (call volume, avg
  duration, DTMF/IVR drop-off, transfer rate) once `Call` data exists.

---

## 4b. Phase D — Multimodal input & intent-aware agents

Confirmed gaps today: `Message.type` only supports `text`/`audio`/`transcript` (no
`image`/`document`); no LLM provider path passes vision content blocks; `Tool` has
no confirmation/slot-filling concept; every turn is a single-shot LLM call with a
flat system prompt — there's no "ask a clarifying question before acting" behavior
built in anywhere. This phase adds both.

### D1. Multimodal input
- Extend `Message.type` to include `image` / `document`; store the file via the
  existing storage integration and reference it by URL in `Message.metadata`
  (mirrors how audio is already handled).
- Add a per-provider `supportsVision` capability flag (Gemini and GPT-4o/Claude
  vision-capable models qualify; Mistral/xAI text-only models don't) and branch
  `agent-runtime.service.ts`'s message construction to send content blocks
  (`{type: "image_url", ...}` / provider-equivalent) instead of plain strings when
  the active model supports it and the incoming message carries an attachment.
- Wire ingestion per channel: WhatsApp already supports media messages at the API
  level — `whatsapp.service.ts` needs to download the media and pass it through
  instead of only handling `msg.text.body`. Web chat needs a file/image upload
  control that reuses the existing file-upload flow. Voice stays audio-only for
  now (see "explicitly parked" below for video).

### D2. Intent-first / clarifying-question behavior
Today the agent goes straight from user input to either a direct answer or a tool
call. For an enterprise product (bookings, payments, data lookups) this is risky —
it should confirm it understood the request before acting.

- **Per-tool confirmation flag**: add `requiresConfirmation: Boolean` to the `Tool`
  model. When set, `tool-executor.service.ts` must not execute until the agent has
  restated the action and parameters back to the user and received an explicit
  yes — mirrors "always ask before a side-effecting action," not a blanket rule
  applied to every tool.
- **Slot-filling in the system prompt layer**: extend the agent config (already
  JSON on `Agent.metadata`) with a `requiredSlots` list per tool/intent (e.g. a
  booking tool might require `date`, `time`, `service`). Before calling the tool,
  the runtime checks which required slots are missing from context and, if any
  are, the model is instructed to ask for them rather than guess or call the tool
  with placeholders. This is a prompt-construction change in
  `agent-runtime.service.ts`, not a new model — keep it cheap.
- **Ambiguous-intent fallback**: when the model's confidence/intent match is low
  (heuristic: no matching tool, or multiple plausible tools), the default
  behavior becomes "ask a clarifying question" instead of guessing. This should
  be a per-agent toggle (`clarifyBeforeActing: boolean`, default true for new
  agents), not forced globally — some simple FAQ-style agents won't need it.

### D3. Deliberate reasoning depth (optional, per agent)
Not every agent needs multi-step reasoning — a simple FAQ bot shouldn't pay the
latency cost. Add a per-agent `reasoningDepth: "fast" | "deliberate"` setting:
- `fast` (default): today's single-shot call — keep this for latency-sensitive
  voice agents.
- `deliberate`: an explicit two-pass turn — first pass classifies intent and
  checks required slots/ambiguity (D2), second pass generates the actual
  response/tool call. Reserve this for complex text/WhatsApp agents where a
  second LLM round-trip's latency is acceptable; do not default it on for voice,
  where response latency is already the tightest constraint in this plan.

This phase depends on nothing in Phase A–C and can be built in parallel, but should
land in the design pass alongside them since it changes what the chat UI needs to
render (image attachments, inline confirmation prompts).

---

## 5. Explicitly parked (do not build yet)

Carried over from the Notion roadmap's Phase 5 — still correctly deprioritized:
Workflows (visual/React Flow builder), Squads (multi-source parallel search), Voice
Library (cloning UI beyond what exists), granular custom RBAC beyond
admin/member, barge-in/interruption tuning. Also parking: live video/vision input
on voice calls (LiveKit supports video tracks, but combining that with real-time
STT/TTS latency budgets is a separate project from D1's async image/document
support). Revisit only after Phases A–D ship and there's a paying-customer reason
to build them.

---

## 6. Sequencing

1. Phase A1–A2 **and A7's `Contact` model** (data models) unblock everything else —
   do these together, one migration. `Call.contactId`/`Chat.contactId` reference
   `Contact` directly, so designing them apart just means a second migration later
   to add the FK.
2. Phase B's CI + security items are cheap and should land alongside A1–A2/A7, not
   wait for telephony to finish.
3. Phase A3–A6 (DTMF, transfer, outbound, recording) build on A1–A2. A7's memory
   read/write in `runTurn` can land independently of these — it only depends on
   `Contact` existing, not on DTMF/transfer/recording being done.
4. Phase D (multimodal + intent-aware agents) is independent and can run in
   parallel with A/B/C — it touches the runtime and chat UI, not telephony.
5. Phase C (admin pages) follows naturally once A1–A2 exist to query against.
6. Design pass (`/design`) targets the *result* of this plan — current app shell +
   the new Numbers/Live Calls admin pages + image attachments and inline
   confirmation prompts in chat — so the visual system covers the real surface
   area, not the old n8n-gateway assumptions.

---

## 7. Implementation checklist (PR by PR)

Design reference for every UI item below: the `Jibu AI Platform Redesign` canvas
(`Numbers.dc.html`, `Calls.dc.html`, `Contacts.dc.html`, `Workspace.dc.html`).
Twilio is a valid `PhoneNumber.provider` (a SIP trunk into LiveKit) — the removed
code was the old direct webhook/`voice.service.ts` path only, not Twilio as a
provider option.

### PR 0 — CI (do first, cheap, unblocks safe review of everything after)
- [ ] GitHub Actions workflow: lint + typecheck + `nx affected:test` +
      `nx affected:build` on every PR
- [ ] `helmet()` + `@nestjs/throttler` on the global Nest pipeline
- [ ] CORS locked to an explicit origin allowlist (no `origin: true` fallback)
- [ ] Gate `/api/docs` (Swagger) behind `NODE_ENV !== 'production'`

### PR 1 — Data models: `PhoneNumber` + `Call` + `Contact`
- [ ] `PhoneNumber` model (schema.prisma) — replaces `Agent.metadata.channels.voice.phoneNumber`
- [ ] `Call` model — replaces the loose `callSid` string on `AgentSession`
- [ ] `Contact` model — `@@unique([workspaceId, externalId])`, `channel` enum-ish string (`"phone"|"whatsapp"|"widget"`)
- [ ] `Call.contactId` / `Chat.contactId` FKs to `Contact`
- [ ] One migration covering all three (see §6.1 — do not split)
- [ ] No UI in this PR — models + migration only, verify `prisma migrate dev` + `prisma generate` clean

### PR 2 — Members UI reconciliation
- [ ] Audit `workspace/[workspaceId]/members/page.tsx` vs `workspace/[workspaceId]/settings/members/page.tsx` — confirm which is live/linked from nav
- [ ] Delete the unused duplicate, keep the canonical one
- [ ] Match visual style to `Workspace.dc.html`
- [ ] No backend change expected — confirm Better Auth org-plugin endpoints already cover invite/list/remove/role-change; only build backend if a real gap is found

### PR 3 — Phone Numbers: backend + frontend
- [ ] `modules/v1/phone-number`: CRUD + assign-to-agent, wrapping LiveKit's SIP trunk API
- [ ] `livekit-agent.service.ts`: resolve agent by `PhoneNumber.agentId` instead of the JSON metadata path
- [ ] Frontend `Numbers` page matching the revised design: Africa's Talking + Twilio as connected SIP trunks, Safaricom/Airtel as connectable
- [ ] Depends on: PR 1

### PR 4 — Call logging
- [ ] `factory.py` / `AgentRuntimeService`: create/update `Call` rows (status, direction, duration, transcript) as calls happen
- [ ] Workspace/admin **Calls** page matching `Calls.dc.html` (live count, avg duration, transfer %, failed count, call table)
- [ ] Depends on: PR 1 (benefits from PR 3 for real number attribution, not blocking)

### PR 5 — Contact resolution
- [ ] Resolve `Contact` from caller phone number (voice/WhatsApp) or authenticated widget user id at call/chat start
- [ ] Link resolved `Contact` onto `Call`/`Chat`
- [ ] Anonymous callers (no resolvable identity) stay contact-less — do not fabricate an identity
- [ ] Depends on: PR 1, PR 4

### PR 6 — Memory layer (Mem0 + Qdrant)
- [ ] `mem0ai` + `qdrant-client` deps; per-workspace Qdrant collection (`agent_memories_${workspaceId}`) via existing `VectorDbService.ensureCollection` (same pattern as `kb_${knowledgeBaseId}`)
- [ ] Read hook: start of `AgentRuntimeService.runTurn()`, before the LLM call — fetch `Contact`'s memory profile, inject into system prompt
- [ ] Write hook: after `runTurn()` completes, fire-and-forget — extract facts, upsert to Qdrant
- [ ] Mem0's own extraction LLM/embedder default to local Ollama, per-workspace overridable
- [ ] `Contacts` page wired to real data, matching `Contacts.dc.html` (contact list, Memory section, Recent activity)
- [ ] Depends on: PR 5

### PR 7 — DTMF
- [ ] Subscribe to LiveKit's SIP DTMF event on the room (`apps/livekit-agent/src/agent/`)
- [ ] Feed digits into `runTurn` as a distinct input type (`type: "dtmf"`)
- [ ] Support sending DTMF out (`publish_dtmf`) for agents navigating a third-party IVR
- [ ] Depends on: PR 1 (needs `Call` to log against); independent of PR 5/6

### PR 8 — Call transfer
- [ ] Cold transfer via SIP REFER (LiveKit's `perform_transfer`)
- [ ] Expose as agent tools: `transfer_to_human`, `transfer_to_number`
- [ ] Warm transfer (hold + bridge) explicitly deferred to a later iteration
- [ ] Depends on: PR 4

### PR 9 — Outbound & batch calling (end goal)
- [ ] `POST /v1/calls/outbound` — single call, creates a LiveKit SIP participant, logs to `Call`
- [ ] `POST /v1/calls/batch` — CSV upload → queued via existing BullMQ worker infra
- [ ] Reuses the same `AgentRuntimeService` turn loop as inbound — no separate code path
- [ ] Depends on: PR 1, PR 3, PR 4 — materially better with PR 5/6 (contacts carry memory into outbound) and PR 7 (DTMF-driven batch IVR flows) already in, but not strictly blocked on them

### PR 10 — Recording
- [ ] Enable LiveKit room recording (Egress) opt-in per agent config
- [ ] Store resulting URL on `Call.recordingUrl` via the existing storage integration layer
- [ ] Depends on: PR 4 only — can slot in anytime after

### Independent track — Phase D (can run in parallel with any of the above)
- [ ] D1: `Message.type` gains `image`/`document`; per-provider `supportsVision` flag; WhatsApp media ingestion; web chat file upload
- [ ] D2: `Tool.requiresConfirmation`; per-tool/intent `requiredSlots`; per-agent `clarifyBeforeActing` (default `true` for new agents)
- [ ] D3: per-agent `reasoningDepth: "fast"|"deliberate"` — `fast` stays default for voice
