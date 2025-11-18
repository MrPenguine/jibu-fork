# Admin Dashboard Implementation Guide

## Overview

This guide provides a roadmap for implementing the enterprise admin dashboard for jibu-console. The implementation is divided into 4 phases over 8 weeks.

---

## Document Structure

### Main Planning Document
**`admin-panel.md`** - Master plan with architecture decisions, schema changes, and high-level roadmap

### Backend Architecture
**`backend-hosting.md`** - Detailed analysis of backend hosting options and recommendation for shared backend with network isolation

### Phase-Specific Implementation Guides

1. **`admin-phase-1-foundations.md`** (Weeks 1-2)
   - Database schema additions (billing, usage, admin RBAC)
   - AdminGuard implementation
   - Dashboard with real data
   - Network isolation setup

2. **`admin-phase-2-user-workspace-management.md`** (Weeks 3-4)
   - User management (list, search, suspend)
   - Workspace management (list, search, details)
   - Backend services and controllers
   - Frontend data tables

3. **`admin-phase-3-billing-cost-intelligence.md`** (Weeks 5-6)
   - Plan management (CRUD)
   - Subscription management
   - Usage tracking integration
   - Cost analytics dashboard
   - Revenue metrics (MRR/ARR)

4. **`admin-phase-4-analytics-logs-audit.md`** (Weeks 7-8)
   - Agent/conversation analytics
   - Admin audit log viewer
   - Webhook monitoring
   - System logs integration
   - Grafana dashboard embedding

---

## Quick Start

### Prerequisites
- Phase 1 schema must be applied before starting any other phase
- Each phase builds on the previous one
- Backend and frontend work can be done in parallel within each phase

### Implementation Order

```
Week 1-2: Phase 1 (Foundations)
├── Day 1-2: Schema migration
├── Day 3-4: AdminGuard + AdminModule
├── Day 5-7: Dashboard service
└── Day 8-10: Frontend integration

Week 3-4: Phase 2 (User & Workspace Management)
├── Day 1-3: User management backend
├── Day 4-5: User management frontend
├── Day 6-8: Workspace management backend
└── Day 9-10: Workspace management frontend

Week 5-6: Phase 3 (Billing & Cost)
├── Day 1-2: Plan management
├── Day 3-4: Subscription management
├── Day 5-7: Usage tracking integration
└── Day 8-10: Analytics dashboard

Week 7-8: Phase 4 (Analytics & Logs)
├── Day 1-3: Analytics services
├── Day 4-5: Audit log viewer
├── Day 6-7: Webhook monitoring
└── Day 8-10: Grafana integration
```

---

## Key Architectural Decisions

### 1. Backend Hosting
**Decision**: Shared backend with network-level isolation

- Single NestJS application
- User API on port 3000 (public)
- Admin API on port 3001 (IP-restricted)
- AdminGuard for authentication
- Nginx for routing and IP whitelisting

**See**: `backend-hosting.md` for full rationale

### 2. Admin Authentication
**Decision**: Extend existing User model with admin flags

- Add `isAdmin` and `adminRole` to User model
- Reuse Supabase authentication
- No separate admin user table
- AdminGuard checks `user.isAdmin === true`

### 3. Audit Logging
**Decision**: Middleware-based automatic logging

- AdminAuditMiddleware logs all admin actions
- Logs include: action, target, details, IP, timestamp
- Applied globally to `/admin/*` routes
- Non-blocking (doesn't fail requests)

### 4. Usage Tracking
**Decision**: Separate UsageRecord model

- Track all billable events (LLM, TTS, STT, calls)
- Store cost in microUSD (avoid floating point)
- Link to workspace, agent, session
- Indexed for fast aggregation queries

---

## Database Schema Summary

### New Models (Phase 1)
- `Plan` - Subscription plans
- `Subscription` - Workspace subscriptions
- `UsageRecord` - Usage tracking
- `AdminAuditLog` - Admin action logs

### Extended Models (Phase 1)
- `User` - Add `isAdmin`, `adminRole`, `isSuspended`
- `Workspace` - Add `isSuspended`, `suspendedBy`, `suspensionReason`
- `Agent` - Add relation to `UsageRecord`

---

## API Endpoints Summary

### Phase 1: Dashboard
- `GET /api/admin/dashboard/stats` - Platform metrics
- `GET /api/admin/dashboard/health` - System health

### Phase 2: Users & Workspaces
- `GET /api/admin/users` - List users
- `GET /api/admin/users/:id` - User details
- `PATCH /api/admin/users/:id/suspend` - Suspend user
- `GET /api/admin/workspaces` - List workspaces
- `GET /api/admin/workspaces/:id` - Workspace details
- `PATCH /api/admin/workspaces/:id/suspend` - Suspend workspace

### Phase 3: Billing
- `GET /api/admin/plans` - List plans
- `POST /api/admin/plans` - Create plan
- `GET /api/admin/subscriptions` - List subscriptions
- `GET /api/admin/analytics/revenue` - Revenue metrics
- `GET /api/admin/analytics/costs` - Cost breakdown

### Phase 4: Analytics & Logs
- `GET /api/admin/analytics/agents` - Agent performance
- `GET /api/admin/analytics/conversations` - Conversation metrics
- `GET /api/admin/audit-logs` - Admin action logs
- `GET /api/admin/logs/chats` - Chat logs
- `GET /api/admin/logs/webhooks` - Webhook invocations

---

## Frontend Pages Summary

### Existing (to be updated)
- `(admin)/page.tsx` - Dashboard (replace mocks with real data)
- `(admin)/users/page.tsx` - User management
- `(admin)/workspaces/page.tsx` - Workspace management
- `(admin)/billing/page.tsx` - Billing & finance
- `(admin)/logs/page.tsx` - System logs
- `(admin)/analytics/page.tsx` - Analytics
- `(admin)/settings/page.tsx` - Settings (deferred)
- `(admin)/credentials/page.tsx` - Credentials (deferred)

### New Pages (Phase 4)
- `(admin)/audit-logs/page.tsx` - Admin audit log viewer

---

## Testing Strategy

### Unit Tests
- All admin services (dashboard, users, workspaces, billing, analytics)
- AdminGuard with various scenarios
- Cost calculation utilities
- Usage tracking logic

### Integration Tests
- Admin API endpoints
- Database queries and aggregations
- Audit logging middleware
- Suspension workflows

### E2E Tests (Optional)
- Admin login flow
- User suspension flow
- Workspace detail view
- Billing dashboard

---

## Security Checklist

- [ ] AdminGuard applied to all admin routes
- [ ] IP whitelisting configured (production)
- [ ] Rate limiting on admin endpoints
- [ ] All admin actions logged to AdminAuditLog
- [ ] Sensitive data redacted in audit logs
- [ ] Admin users cannot suspend other admins
- [ ] Suspended users cannot access platform
- [ ] API keys revoked for suspended workspaces

---

## Deployment Checklist

### Phase 1
- [ ] Run database migration
- [ ] Seed initial admin user
- [ ] Configure ADMIN_ALLOWED_IPS env var
- [ ] Set up Nginx reverse proxy
- [ ] Test AdminGuard
- [ ] Verify dashboard loads with real data

### Phase 2
- [ ] Deploy user management endpoints
- [ ] Deploy workspace management endpoints
- [ ] Test suspension workflows
- [ ] Verify audit logs are created

### Phase 3
- [ ] Seed default plans
- [ ] Deploy billing endpoints
- [ ] Instrument usage tracking in existing code
- [ ] Verify cost calculations
- [ ] Test subscription creation

### Phase 4
- [ ] Deploy analytics endpoints
- [ ] Deploy audit log viewer
- [ ] Configure Grafana dashboards
- [ ] Test webhook monitoring
- [ ] Verify chat search

---

## Monitoring & Observability

### Prometheus Metrics
- `admin_api_requests_total` - Counter by endpoint
- `admin_api_duration_seconds` - Histogram
- `admin_active_sessions` - Gauge
- `admin_audit_logs_total` - Counter by action
- `admin_failed_webhooks_total` - Counter
- `admin_usage_records_total` - Counter by type

### Grafana Dashboards
- Admin API performance
- Admin user activity
- Platform health overview
- Queue statistics
- Cost trends

### Alerts
- Admin API error rate >1%
- Failed admin login attempts >10/min
- Suspended workspace count spike
- Usage tracking failures

---

## Success Criteria

### Phase 1
- ✅ Admin can log in and see real platform metrics
- ✅ Non-admin users cannot access admin routes
- ✅ Database migration completes successfully
- ✅ Audit logging works

### Phase 2
- ✅ Admin can view all users and workspaces
- ✅ Admin can search/filter users and workspaces
- ✅ Admin can suspend/unsuspend accounts
- ✅ Suspension actions are logged

### Phase 3
- ✅ Plans can be created and managed
- ✅ Subscriptions can be assigned to workspaces
- ✅ Usage is tracked for all billable events
- ✅ Cost analytics display correctly
- ✅ Revenue metrics calculate correctly

### Phase 4
- ✅ Agent analytics show performance data
- ✅ Audit logs are searchable and filterable
- ✅ Webhook monitoring shows invocation history
- ✅ Grafana dashboards are embedded
- ✅ Chat search returns relevant results

---

## Troubleshooting

### Common Issues

**AdminGuard not working**
- Check user has `isAdmin: true` in database
- Verify JWT token includes user data
- Check AdminGuard is applied to controller

**Stats not loading**
- Verify database connection
- Check Prisma client is generated
- Verify API endpoint is accessible

**Migration fails**
- Check for conflicting migrations
- Verify database connection
- Review migration SQL for errors

**Audit logs not created**
- Check middleware is applied
- Verify AdminAuditLog model exists
- Check for errors in middleware

**Usage tracking not working**
- Verify UsageRecord model exists
- Check instrumentation in services
- Verify cost calculations are correct

---

## Next Steps After Phase 4

### Immediate Improvements
- Add more detailed analytics
- Implement data export (CSV)
- Add email notifications for critical events
- Improve search with full-text indexing

### Future Enhancements
- Multi-region monitoring
- Advanced cost anomaly detection
- Reseller/partner portal
- Deep support hub integration
- Per-organization SSO
- Compliance tooling (GDPR, HIPAA)

---

## Resources

### Documentation
- NestJS: https://docs.nestjs.com
- Prisma: https://www.prisma.io/docs
- Next.js: https://nextjs.org/docs
- Shadcn UI: https://ui.shadcn.com

### Internal Docs
- `IMPLEMENTATION_COMPLETE.md` - Webhook queue implementation
- `TESTING_GUIDE.md` - Testing best practices
- `README.md` - Project setup

### Code Examples
- Webhook queue system (91% test coverage)
- Existing v1 API modules
- Frontend admin stub pages

---

## Support

For questions or issues during implementation:
1. Review the phase-specific guide
2. Check the troubleshooting section
3. Review existing code patterns (webhook queue, v1 API)
4. Consult the main `admin-panel.md` document

---

**Last Updated**: 2025-11-17
**Version**: 1.0.0
**Status**: Ready for Implementation
