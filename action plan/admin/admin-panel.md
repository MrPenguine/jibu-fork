## **Enterprise Admin Dashboard – Implementation Plan (Aligned With Current Codebase)**

This document translates the enterprise "command center" vision into a **practical, phased implementation plan** for the current `jibu-console` codebase.

It is written from the perspective of where the project is today:

- **Multi-tenant core**: `User` → `WorkspaceMembership` → `Workspace`
- **Agent-centric product**: `Agent`, `Assistant`, `Workflow`, `WorkflowVersion`, `AgentSession`, `Chat`, `Message`
- **Voice/webhook infra**: Production-ready queue + webhook delivery stack
- **Admin UI scaffolding**: Next.js `(admin)` route group with stub pages

The goal is to:

- Focus on **high-impact, near-term admin features** (billing, usage, support, safety)
- Avoid overbuilding NOC / reseller / SSO systems before they are needed
- Fit cleanly into existing **NestJS backend** and **Prisma** schema

---

## **1. Backend Architecture Decision**

### **Shared Backend with Network-Level Isolation**

We will use a **single NestJS backend** serving both user API (`/api/v1/*`) and admin API (`/api/admin/*`), with network-level security isolation.

**Implementation**:
- User API: Port 3000 (public)
- Admin API: Port 3001 (IP-restricted) OR path-based with Nginx routing
- AdminGuard for authentication + IP validation
- Nginx reverse proxy for routing and IP whitelisting

**Rationale**:
- Development speed: Single codebase, shared services, direct database access
- Security: Network isolation via separate ports + IP whitelisting
- Your stage: Admin traffic <1% of user traffic, team <10 people
- Future-proof: Code already modular, easy to split later if needed

**See**: `backend-hosting.md` for detailed implementation

---

## **2. Phased Roadmap (What to Build, in What Order)**

### **Phase 1 – Foundations (Weeks 1–2)**
**See**: `admin-phase-1-foundations.md`

- Add schema for billing, usage, and admin RBAC
- Add admin authentication guard on backend
- Wire real data into `(admin)/page.tsx` dashboard (replace mocks)
- Set up network isolation (ports or Nginx)

### **Phase 2 – Core Management (Weeks 3–4)**
**See**: `admin-phase-2-user-workspace-management.md`

- User Management: List/search users, view detail, suspend accounts
- Workspace Management: List/search workspaces, view detail with agents and sessions

### **Phase 3 – Billing & Cost Intelligence (Weeks 5–6)**
**See**: `admin-phase-3-billing-cost-intelligence.md`

- Plan & Subscription Management (Plan CRUD, subscriptions)
- Usage & Cost Analytics (per workspace, per provider)
- Instrument existing code to track usage

### **Phase 4 – Analytics, Logs & Audit (Weeks 7–8)**
**See**: `admin-phase-4-analytics-logs-audit.md`

- Agent/Conversation Analytics (across `AgentSession`, `Chat`, `Message`)
- Admin Audit Logs viewer (who did what)
- Webhook & System Logs (leverage existing queue + infra/grafana)

### **Future Phases – Only After Traction**

- Advanced NOC-style multi-region monitoring, cost anomaly detection
- Reseller/partner portal
- Deep support hub integrated with external tools (Zendesk, Intercom)
- Fine-grained, per-organization SSO and compliance tooling

---

## **2. Schema Additions & Changes (Prisma)**

These changes are designed to:

- Add **commercialization primitives** (plans, subscriptions)
- Add **usage & cost visibility** (usage records)
- Add **admin RBAC** on top of the existing `User` model
- Add **platform-level audit trail** for admin actions

### **2.1 Billing & Subscription Models (CRITICAL)**

```prisma
model Plan {
  id              String         @id @default(cuid())
  name            String         // "Starter", "Pro", "Enterprise"
  priceMonthly    Float?         // null for custom enterprise plans
  priceYearly     Float?
  creditsIncluded Int            // e.g., 10_000 credits per month
  features        Json           // { "apiAccess": true, "customVoices": false }
  isActive        Boolean        @default(true)

  subscriptions   Subscription[]
}

model Subscription {
  id               String     @id @default(cuid())
  workspaceId      String     @unique
  workspace        Workspace  @relation(fields: [workspaceId], references: [id])

  planId           String
  plan             Plan       @relation(fields: [planId], references: [id])

  status           String     // "active", "trialing", "past_due", "canceled"
  stripeCustomerId String?    @unique
  stripeSubId      String?    @unique

  currentPeriodEnd DateTime

  // Credits / limits
  creditsUsed      Int        @default(0)
  creditsLimit     Int?

  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
}

// Workspace model: add the back relation
// model Workspace {
//   ...
//   subscription Subscription?
// }
```

### **2.2 Usage & Cost Tracking**

```prisma
model UsageRecord {
  id             String     @id @default(cuid())

  workspaceId    String
  workspace      Workspace  @relation(fields: [workspaceId], references: [id])

  agentId        String?
  agent          Agent?     @relation(fields: [agentId], references: [id])

  type           String     // "LLM_TOKENS" | "TTS_CHARACTERS" | "STT_SECONDS" | "CALL_MINUTES"
  provider       String     // "OPENAI", "ELEVENLABS", "DEEPGRAM", etc.
  modelUsed      String?
  unitsConsumed  Float      // 1500 (tokens), 2500 (characters), 60 (seconds)
  costInMicroUSD Int        // Cost in millionths of USD (e.g., $0.01 = 10000)

  sessionId      String?    // Link to call/chat session for debugging

  timestamp      DateTime   @default(now())

  @@index([workspaceId, timestamp])
  @@index([type, timestamp])
  @@index([agentId, timestamp])
}
```

Later, you can optionally add `costInMicroUSD` to `Message` or `AgentSession` for direct lookups, but **MVP should rely on `UsageRecord`** for analytics.

### **2.3 Admin RBAC on Top of Existing User Model**

Instead of a separate `AdminUser` table, reuse `User` and extend it.

```prisma
model User {
  id               String                   @id // existing
  email            String                   @unique
  // ...existing fields...

  isAdmin          Boolean                  @default(false)
  adminRole        String?                  // "superadmin" | "engineer" | "support" | "finance"

  adminAuditLogs   AdminAuditLog[]          @relation("AdminActions")
}

model AdminAuditLog {
  id          String   @id @default(cuid())

  adminUserId String
  adminUser   User     @relation("AdminActions", fields: [adminUserId], references: [id])

  action      String   // "SUSPEND_USER", "VIEW_WORKSPACE", "UPDATE_PLAN", etc.
  targetType  String?  // "User" | "Workspace" | "Plan" | ...
  targetId    String?
  details     Json?
  ipAddress   String?

  createdAt   DateTime @default(now())

  @@index([adminUserId])
  @@index([targetType, targetId])
  @@index([createdAt])
}
```

This approach:

- Reuses Supabase-based authentication
- Avoids managing two separate user stores
- Keeps admin actions auditable

### **2.4 Feature Flags / Global Settings (Optional, Later)**

Defer for now. If/when needed, you can introduce:

```prisma
model PlatformSetting {
  id          String   @id // e.g., "ENABLE_CLAUDE_3_5", "GLOBAL_MAINTENANCE_MODE"
  value       Json
  description String?
  updatedAt   DateTime @updatedAt
}
```

But **this is not required for the first admin dashboard release**.

---

## **3. Backend Architecture – Admin Module & Endpoints**

All admin endpoints should:

- Live under **`/api/admin/...`** (or `/admin` at Nest controller level)
- Be protected by an **`AdminGuard`** that checks `user.isAdmin === true`
- Log actions via `AdminAuditLog` where relevant

### **3.1 Admin Auth Guard**

Location: `apps/backend/src/core/guards/admin.guard.ts`

```ts
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.isAdmin) {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}
```

Optional enhancement: IP whitelisting (e.g., via `ADMIN_ALLOWED_IPS` env var) and rate limiting.

### **3.2 Admin Module Structure**

Location: `apps/backend/src/modules/admin`

Suggested structure:

- **`admin.module.ts`**
- **controllers/**
  - `dashboard.controller.ts`
  - `users.controller.ts`
  - `workspaces.controller.ts`
  - `billing.controller.ts`
  - `analytics.controller.ts` (later)
  - `logs.controller.ts` (later)
- **services/**
  - `dashboard.service.ts`
  - `users.service.ts`
  - `workspaces.service.ts`
  - `billing.service.ts`
  - `analytics.service.ts` (later)
  - `logs.service.ts` (later)

Register `AdminModule` in the main backend module and mount routes under `/admin`.

### **3.3 Dashboard Stats Endpoint – `(admin)/page.tsx`**

**Backend** – `GET /admin/dashboard/stats`

Aggregations (MVP):

- Total users, new users (last 30 days)
- Total workspaces
- Total agents
- Active conversations or sessions (last 24h)

Once billing is live, extend with:

- Active subscriptions per plan
- Estimated MRR/ARR from `Subscription`
- Cost totals from `UsageRecord`

**Frontend** – `apps/frontend/src/app/(admin)/page.tsx`

- Replace `mockMetrics` and `mockSystemHealth` with API calls
- Use `StatCard` for metrics
- Optionally, add basic charts using a small chart library

### **3.4 User Management – `(admin)/users`**

**Backend – `AdminUsersController`**

- `GET /admin/users`
  - Pagination: `page`, `limit`
  - Filters: `search` (email/fullName), maybe `planId`
- `GET /admin/users/:id`
  - User details + memberships + workspaces
- `PATCH /admin/users/:id`
  - Capability: suspend/unsuspend (`isSuspended` flag on `User` or related table)
  - Log via `AdminAuditLog`

Impersonation is powerful and should be **postponed** until basic safety features are solid; when added, it should:

- Issue a short-lived token
- Add a visible banner in the frontend
- Always log in `AdminAuditLog` with IP and timestamp

**Frontend – `apps/frontend/src/app/(admin)/users/page.tsx`**

- Replace "Coming Soon" card with a data table
- Columns: Name, Email, Primary Workspace Count, Plan (derived), Last Sign-In, Created At
- Row click → `users/[id]` detail page (future extension)

### **3.5 Workspace Management – `(admin)/workspaces`**

**Backend – `AdminWorkspacesController`**

- `GET /admin/workspaces`
  - Paginated, searchable by name, owner email
- `GET /admin/workspaces/:id`
  - Workspace details
  - Members (`WorkspaceMembership` + `User`)
  - Agents (`Agent`)
  - Recent `Chat` and `AgentSession` entries
  - Recent `UsageRecord` summary

**Frontend – `apps/frontend/src/app/(admin)/workspaces/page.tsx`**

- Replace "Coming Soon" with table
- Columns: Name, Owner, Plan, # Agents, Created At
- Click → `workspaces/[id]` detail (read-only admin view of workspace)

### **3.6 Billing & Finance – `(admin)/billing`**

**Backend – `AdminBillingController`**

- `GET /admin/plans`
- `POST /admin/plans`
- `PATCH /admin/plans/:id`
- `GET /admin/subscriptions` (with filters)
- `GET /admin/analytics/revenue` (time series)
- `GET /admin/analytics/costs` (by provider, by workspace)

**Frontend – `apps/frontend/src/app/(admin)/billing/page.tsx`**

- Replace static "Coming Soon" with:
  - **Revenue tab** – MRR chart, active subscriptions list
  - **Costs tab** – Cost per provider pie chart, top 10 costly workspaces
  - **Plan management section** – List/edit `Plan` entries

### **3.7 Logs & Analytics – `(admin)/logs`, `(admin)/analytics` (Phase 4)**

Leverage existing infra:

- `infra/grafana`, `prometheus/`, `prom-client` usage in backend
- Webhook queue stats (from queue services)

**Logs / Observability**

- `GET /admin/chats` – searchable `Chat` + `Message` logs
- `GET /admin/webhooks` & `/admin/webhooks/failed` – from `WebhookInvocation`
- Optionally embed Grafana dashboards via iframe

**Analytics**

- Agent performance: from `AgentSession`, `Chat` counts, durations
- Volume trends: `Message` count, `UsageRecord` rollups

---

## **4. Frontend Admin Surface – Mapping to Current Routes**

Current admin routes:

- `(admin)/page.tsx` – Dashboard (already has mock UI)
- `(admin)/users/page.tsx` – User Management (stub)
- `(admin)/workspaces/page.tsx` – Workspace Management (stub)
- `(admin)/billing/page.tsx` – Billing & Finance (stub)
- `(admin)/logs/...` – Logs stub
- `(admin)/analytics/...` – Analytics stub
- `(admin)/settings/...` – Settings stub
- `(admin)/credentials/...` – Credentials stub

### **4.1 What to Implement Now (Phases 1–3)**

- **Dashboard** – Replace mock data with `/api/admin/dashboard/stats`
- **Users** – Table + API wiring
- **Workspaces** – Table + API wiring
- **Billing** – Once schema is in place, show:
  - Plans list
  - Active subscriptions list
  - Simple revenue & cost charts

### **4.2 What to Push to Later Phases**

- **Credentials page**
  - Platform-level secrets should live in Vault / AWS Secrets Manager / Doppler
  - Admin UI for this is **optional** and belongs more to DevOps tooling

- **Settings page (feature flags)**
  - Only introduce UI once `PlatformSetting` exists and you actually need runtime toggles

- **Advanced NOC view / multi-region map**
  - You’re not running multi-region yet
  - For now, a simple health widget using Prometheus/Grafana is enough

---

## **5. De-Scoped / Future Ideas (To Avoid Overbuilding Now)**

The original vision included many powerful but **premature** ideas. Keep them as a backlog, not as immediate requirements.

### **5.1 NOC / Global Command Center**

- World map of regions
- Incident center with ownership workflows
- Real-time cost ticker & anomalies

These require:

- Multi-region infra
- Consistent metrics collection
- A dedicated incident management process

→ **Keep as long-term goal**, not Phase 1–3 scope.

### **5.2 Partner & Reseller Portal**

- Partner tiers, commissions, reseller-owned customers

You currently have no reseller program. Building this now would be speculative and high-maintenance.

### **5.3 Deep Support Hub & Third-Party Integrations**

- Full integration with Zendesk/Intercom, Stripe, logging systems
- Unified user timeline view across those systems

You can approximate some of this **just from your own database** first:

- Recent chats/calls
- Recent errors (once surfaced via logs)
- Billing status from `Subscription`

### **5.4 Telephony CQD / LCR Control Plane**

- MOS/jitter/packet loss dashboards
- Least-cost routing rules, multi-carrier pools

These depend on:

- How much you expose vs rely on underlying providers (Twilio/LiveKit)

→ For now, **keep call quality telemetry mostly in provider dashboards and Grafana**.

---

## **6. Security, Testing & Quality Expectations**

Follow the same standards as your webhook/queue work (which already has excellent quality & coverage).

### **6.1 Security**

- All admin routes **must** use `AdminGuard`
- Consider IP allowlist + throttling for admin endpoints
- Log sensitive actions (`SUSPEND_USER`, `UPDATE_PLAN`, etc.) to `AdminAuditLog`
- Never expose platform secrets in the UI (credentials page stays out-of-scope for now)

### **6.2 Testing**

- Unit tests for admin services (`AdminUsersService`, `AdminWorkspacesService`, etc.)
- Integration tests for critical flows:
  - Listing users/workspaces
  - Updating subscription/plan
  - Creating usage records and aggregating stats

### **6.3 Observability**

- Use `prom-client` metrics for admin API latency & error rates
- Add basic Grafana dashboards and, later, embed them in `(admin)/analytics`

---

## **7. Summary – What This Plan Gives You**

By following this updated plan, you get:

- A **real, shippable admin console** in ~2 months of focused work
- A clear path to **monetization** (plans, subscriptions, cost visibility)
- Powerful tools for **support & operations** (user/workspace views, logs, analytics)
- Strong **security & auditability** for enterprise conversations

Without:

- Overbuilding speculative infrastructure like multi-region NOC, reseller portals, or complex feature flag systems before they are truly needed.

This document is now the **source of truth** for implementing the admin dashboard in `jibu-console` based on the current state of your schema, backend, and frontend.