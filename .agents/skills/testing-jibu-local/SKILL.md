---
name: testing-jibu-local
description: How to run and browser-test the Jibu local stack (Next.js frontend + NestJS backend + Better Auth organizations/workspaces), including signup, workspace switching, invitations, member management, and DB cross-checks.
---

# Testing the Jibu app locally

## Services / ports
- Frontend (Next dev): http://localhost:3000
- Backend (NestJS): http://localhost:4000/api (Swagger at /api/docs)
- Worker: binds `WORKER_PORT` (3001); a `PORT=3002` in `apps/worker/.env` is ignored.
- Docker infra: postgres, redis:6379, qdrant:6333, vault:8200, n8n:5678, ollama (host port 11435), livekit:7880.
- LiveKit compose commands need both files:
  `docker compose -f docker-compose.yml -f /home/ubuntu/jibu-fork-livekit.override.yml ...`
  and `infra/livekit.yaml`'s secret must be >= 32 chars and match `LIVEKIT_API_SECRET` in `apps/backend/.env`.
- Logs (when started by an agent): `/home/ubuntu/jibu-{backend,worker,frontend}.log`.

## Database access
There is no host `psql` binary. Use:
```
docker exec jibu-fork-postgres-1 psql -U postgres -d jibu -c "<sql>"
```
Useful tables: `auth_users`, `auth_sessions` (`activeOrganizationId`), `auth_accounts`,
`User`, `Workspace`, `WorkspaceMembership`, `Invitation`.

## Auth (Better Auth, no Supabase)
- Signup is local email/password at `/signup`, auto-signs-in, and provisions exactly one
  workspace (`<email>'s Workspace`) with an `owner` membership. Password `TestPass123!` works.
- Better Auth's organization plugin is mapped onto `Workspace`/`WorkspaceMembership`/`Invitation`,
  so `Workspace.id === organization.id`. New workspaces created after the migration get
  Better-Auth-style string ids (e.g. `btQiDrmICYwoJscln8yCUKWzHWyoAu2k`), not UUIDs — don't assume UUIDs.
- Known/expected: the very first session right after signup has `activeOrganizationId = NULL`
  and falls back to verified membership until the next sign-in.
- Unauthorized `/workspace/<id>` access redirects to `/login/error?reason=workspace-access`.

## Landmine: stale localStorage/sessionStorage workspace id
`workspaceContext` still reads `activeWorkspaceId` from local/sessionStorage. If you reuse the same
browser profile across test accounts, a stale id makes `/workspaces` return
`You are not a member of this workspace` and the dashboard hangs on skeletons.
Fix: clear site data for localhost (Chrome site settings) or use a fresh Incognito window per account.
Use one normal window + one Incognito window to test two accounts side by side.

## Invitations
- There are TWO invite UIs and they behave differently:
  - `/workspace/<id>/members` → "Invite members" dialog. This one may be broken: it POSTs
    `{email, role}` while the backend DTO expects `{emails: [...], role}` → 400
    `emails should not be empty,emails must be an array`.
  - `/workspace/<id>/settings/members` → "Invite Members" dialog (shadcn `InviteMembers`), which
    sends `{emails: [...]}` correctly. **Prefer this path.** Note it validates that the invitee
    email is already registered ("This email is not registered. The user needs to sign up first."),
    so sign the second account up BEFORE inviting.
- No email transport. Grab the link from the backend log:
  `grep "Better Auth" /home/ubuntu/jibu-backend.log` → `http://localhost:3000/invite/<invitationId>`
  (or read `Invitation.id` from the DB).
- Accepting at `/invite/<id>` lands the user on `/workspace/<invitingWorkspaceId>`.

## Member management
- Remove member works (`DELETE /workspaces/:id/members/:memberId`).
- Role change may be broken: the UI calls `PATCH /workspaces/:id/members/:memberId` while the
  backend only exposes `PUT /workspaces/:id/members/:memberId/role` → `Cannot PATCH ...`.
  Check `apps/backend/src/modules/v1/workspace/workspace.controller.ts` for the current routes.

## API keys (Better Auth apiKey plugin, workspace-owned)
- UI: `/workspace/<workspaceId>/settings/api-keys`, reachable from the "API Keys" card on
  `/workspace/<workspaceId>/settings`. Create takes a name + optional expiry **in days**
  (the page multiplies by 86400 before sending `expiresIn`).
- Plaintext is shown **once** in the "Save your API key" dialog (starts with `jibu_`). Grab it there —
  the list only shows `start` (e.g. `jibu_e`). Reading it later requires Reveal + the account password
  and a cookie session younger than 1h; plaintext lives in Vault, Better Auth stores only a hash.
- DB table is `auth_api_keys` (Prisma model `AuthApiKey`, no `@@map`, so snake_plural):
  `docker exec jibu-fork-postgres-1 psql -U postgres -d jibu -c "select id,name,start,enabled,\"expiresAt\" from auth_api_keys where \"referenceId\"='<workspaceId>';"`
  Querying `"AuthApiKey"` fails — don't assume the Prisma model name is the table name.
- Rotate creates a **new key id** and deletes the old row, so after rotating the list `start` changes and
  the old id disappears from the DB. Revoke sets `enabled=false` and disables Reveal/Rotate/Revoke in the row.
- `x-api-key` is a real auth path (shell testing is legitimate here — no cookies needed):
  ```
  curl -s -H "x-api-key: <key>" http://localhost:4000/api/api-keys
  curl -s -H "x-api-key: <key>" http://localhost:4000/api/workspaces/<otherWorkspaceId>/members  # 403 "API key is restricted to its workspace"
  ```
  A forged `x-workspace-id` header is ignored (the key's `referenceId` wins). Revoked keys return 401.
  `lastRequest` (list column "Last used") only populates after a request; reload the page to see it.
- For tenant-isolation tests you need a second workspace the test account is NOT a member of — reuse any
  older `Workspace` row from the DB rather than creating a whole second account.

## UI quirks that are not auth bugs
- Switching workspaces via the switcher updates the sidebar/context but does NOT rewrite the URL;
  the page then shows `<new workspace name> (viewing <old id>)`. Navigate to `/` to confirm the
  server-side active organization (middleware resolves it from the session, not localStorage).
- A hardcoded "Recent → Sales Prospector (Phone)" card appears on every new workspace.
- Verbose `WorkspaceSwitcher` / `[CONTEXT INIT]` / `[getActiveWorkspaceId]` console logs are expected noise.
- Accepted invitations may still be listed under "Pending Invitations" even when
  `Invitation.status = 'accepted'` in the DB — verify against the DB before calling it a pass.

## Devin Secrets Needed
None for the local auth/organization flows. For LiveKit AI voice replies you additionally need the
`apps/livekit-agent` provider keys (`GOOGLE_API_KEY`/`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`,
`ELEVENLABS_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `DEFAULT_AGENT_ID`);
mic capture is unavailable on a headless box (`NotFoundError: Requested device not found`).
