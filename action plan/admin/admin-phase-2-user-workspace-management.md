# Admin Dashboard - Phase 2: User & Workspace Management (Weeks 3-4)

## Overview

Implement core admin capabilities for managing users and workspaces.

**Prerequisites**: Phase 1 complete (schema, AdminGuard, dashboard)

**Deliverables**:
- User list with search/pagination
- User detail view with actions (suspend/unsuspend)
- Workspace list with search/pagination
- Workspace detail view with members, agents, sessions

---

## Backend Services

### User Management Service
**Location**: `apps/backend/src/modules/admin/services/users.service.ts`

Key methods:
- `findAll(query)` - Paginated user list with search
- `findOne(id)` - User details with workspaces, API keys, activity
- `suspend(id, dto)` - Suspend user account
- `unsuspend(id)` - Reactivate user
- `getActivityStats(id)` - User activity metrics

### Workspace Management Service
**Location**: `apps/backend/src/modules/admin/services/workspaces.service.ts`

Key methods:
- `findAll(query)` - Paginated workspace list
- `findOne(id)` - Workspace details with members, agents, sessions
- `suspend(id, dto)` - Suspend workspace
- `unsuspend(id)` - Reactivate workspace
- `getUsageStats(id, days)` - Usage metrics

---

## API Endpoints

### Users
- `GET /api/admin/users` - List users (paginated, searchable)
- `GET /api/admin/users/:id` - User details
- `GET /api/admin/users/:id/stats` - User activity stats
- `PATCH /api/admin/users/:id/suspend` - Suspend user
- `PATCH /api/admin/users/:id/unsuspend` - Unsuspend user

### Workspaces
- `GET /api/admin/workspaces` - List workspaces
- `GET /api/admin/workspaces/:id` - Workspace details
- `GET /api/admin/workspaces/:id/usage` - Usage stats
- `PATCH /api/admin/workspaces/:id/suspend` - Suspend workspace
- `PATCH /api/admin/workspaces/:id/unsuspend` - Unsuspend workspace

---

## Frontend Pages

### Users List
**Location**: `apps/frontend/src/app/(admin)/users/page.tsx`

Features:
- Data table with user info
- Search by email/name
- Pagination
- Status badges (Admin, Suspended, Active)
- Click row to view details

### Workspaces List
**Location**: `apps/frontend/src/app/(admin)/workspaces/page.tsx`

Features:
- Data table with workspace info
- Search by name/email
- Owner information
- Agent/chat counts
- Click row to view details

---

## Testing Checklist

### Backend
- [ ] User list returns paginated results
- [ ] User search works correctly
- [ ] User detail includes all relations
- [ ] Suspend/unsuspend updates database
- [ ] Workspace list returns correct data
- [ ] Workspace detail includes members/agents

### Frontend
- [ ] Users table loads and displays data
- [ ] Search filters users correctly
- [ ] Pagination works
- [ ] Status badges display correctly
- [ ] Workspaces table loads data
- [ ] Click navigation works

---

## Implementation Notes

1. **Services**: Create full CRUD services for users and workspaces
2. **Controllers**: Add to AdminModule with AdminGuard
3. **Frontend**: Replace "Coming Soon" cards with data tables
4. **Audit**: All suspend/unsuspend actions logged via middleware

See full implementation details in codebase examples.
