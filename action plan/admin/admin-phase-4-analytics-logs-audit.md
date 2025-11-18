# Admin Dashboard - Phase 4: Analytics, Logs & Audit (Weeks 7-8)

## Overview

Implement advanced analytics, system logs, and audit trail viewing.

**Prerequisites**: Phase 1-3 complete

**Deliverables**:
- Agent/conversation analytics
- Admin audit log viewer
- Webhook monitoring
- System logs integration
- Grafana dashboard embedding

---

## Backend Services

### Analytics Service
**Location**: `apps/backend/src/modules/admin/services/analytics.service.ts`

Key methods:
- `getAgentPerformance(period)` - Agent metrics
- `getConversationMetrics(period)` - Chat/session stats
- `getPopularAgents(limit)` - Most used agents
- `getAverageSessionDuration()` - Duration metrics
- `getMessageVolume(period)` - Message trends

### Audit Log Service
**Location**: `apps/backend/src/modules/admin/services/audit.service.ts`

Key methods:
- `findAll(query)` - Paginated audit logs
- `findByAdmin(adminId, query)` - Logs by admin
- `findByTarget(targetType, targetId)` - Logs for entity
- `getActionSummary(period)` - Action counts

### Logs Service
**Location**: `apps/backend/src/modules/admin/services/logs.service.ts`

Key methods:
- `getChats(query)` - Searchable chat logs
- `getMessages(chatId)` - Messages for chat
- `getWebhookInvocations(query)` - Webhook logs
- `getFailedWebhooks()` - Failed deliveries
- `getQueueStats()` - Queue metrics

---

## API Endpoints

### Analytics
- `GET /api/admin/analytics/agents` - Agent performance
- `GET /api/admin/analytics/conversations` - Conversation metrics
- `GET /api/admin/analytics/popular-agents` - Top agents
- `GET /api/admin/analytics/message-volume` - Volume trends

### Audit Logs
- `GET /api/admin/audit-logs` - List audit logs
- `GET /api/admin/audit-logs/admins/:id` - Logs by admin
- `GET /api/admin/audit-logs/summary` - Action summary

### System Logs
- `GET /api/admin/logs/chats` - Chat logs
- `GET /api/admin/logs/chats/:id/messages` - Chat messages
- `GET /api/admin/logs/webhooks` - Webhook invocations
- `GET /api/admin/logs/webhooks/failed` - Failed webhooks
- `GET /api/admin/logs/queue-stats` - Queue statistics

---

## Frontend Pages

### Analytics Dashboard
**Location**: `apps/frontend/src/app/(admin)/analytics/page.tsx`

**Sections**:
1. **Agent Performance**
   - Most active agents
   - Average session duration
   - Success/failure rates
   - Usage by agent type

2. **Conversation Metrics**
   - Total conversations
   - Average messages per conversation
   - Session duration distribution
   - Peak usage times

3. **Message Volume**
   - Messages over time (chart)
   - By session type (call vs chat)
   - Growth trends

### Audit Logs Page
**Location**: `apps/frontend/src/app/(admin)/audit-logs/page.tsx`

Features:
- Filterable table of admin actions
- Filter by admin, action type, target
- Date range selector
- Action details modal
- Export to CSV

### System Logs Page
**Location**: `apps/frontend/src/app/(admin)/logs/page.tsx`

**Tabs**:
1. **Conversations**
   - Searchable chat logs
   - Filter by workspace, agent, session type
   - View messages inline

2. **Webhooks**
   - Webhook invocation history
   - Failed deliveries
   - Retry status
   - Payload viewer

3. **System Health**
   - Embedded Grafana dashboards
   - Queue statistics
   - Database metrics

---

## Agent Analytics Queries

### Most Active Agents (Last 30 Days)
```typescript
const topAgents = await prisma.agent.findMany({
  where: {
    sessions: {
      some: {
        createdAt: { gte: thirtyDaysAgo },
      },
    },
  },
  select: {
    id: true,
    name: true,
    workspace: {
      select: { name: true },
    },
    _count: {
      select: {
        sessions: {
          where: { createdAt: { gte: thirtyDaysAgo } },
        },
      },
    },
  },
  orderBy: {
    sessions: {
      _count: 'desc',
    },
  },
  take: 10,
});
```

### Average Session Duration
```typescript
const avgDuration = await prisma.$queryRaw`
  SELECT 
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
  FROM agent_session
  WHERE status = 'completed'
    AND created_at >= ${thirtyDaysAgo}
`;
```

### Message Volume by Day
```typescript
const messageVolume = await prisma.$queryRaw`
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM message
  WHERE created_at >= ${thirtyDaysAgo}
  GROUP BY DATE(created_at)
  ORDER BY date ASC
`;
```

---

## Audit Log Viewer

### Filter Options
- Admin user
- Action type (SUSPEND_USER, UPDATE_PLAN, etc.)
- Target type (User, Workspace, Plan)
- Date range
- IP address

### Display Format
```typescript
interface AuditLogDisplay {
  timestamp: string;
  admin: {
    name: string;
    email: string;
  };
  action: string;
  target: {
    type: string;
    id: string;
    name?: string;
  };
  details: any;
  ipAddress: string;
}
```

---

## Webhook Monitoring

### Leverage Existing Infrastructure

Your webhook queue system already tracks:
- `WebhookInvocation` table
- Status (pending, completed, failed)
- Payload and headers
- Error messages

**Admin View**:
```typescript
const failedWebhooks = await prisma.webhookInvocation.findMany({
  where: {
    status: 'failed',
    createdAt: { gte: oneDayAgo },
  },
  include: {
    webhook: {
      select: {
        name: true,
        workflow: {
          select: {
            name: true,
          },
        },
      },
    },
    workspace: {
      select: {
        name: true,
      },
    },
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

---

## Grafana Integration

### Embed Dashboards

**Location**: `apps/frontend/src/app/(admin)/analytics/page.tsx`

```typescript
<div className="space-y-6">
  <h2>System Metrics</h2>
  
  {/* Platform Overview Dashboard */}
  <iframe
    src="http://localhost:3001/d/platform-overview?orgId=1&theme=light&kiosk"
    width="100%"
    height="600px"
    frameBorder="0"
  />
  
  {/* Queue Metrics Dashboard */}
  <iframe
    src="http://localhost:3001/d/queue-metrics?orgId=1&theme=light&kiosk"
    width="100%"
    height="400px"
    frameBorder="0"
  />
</div>
```

### Create Grafana Dashboards

**Location**: `infra/grafana/dashboards/admin-overview.json`

Panels:
- API request rate
- Database query performance
- Queue depth (webhook, indexing)
- Error rate by endpoint
- Active connections

---

## Queue Statistics

### Leverage Worker Metrics

Your worker already has scaling service that monitors:
- Queue depth
- Active jobs
- Failed jobs
- Processing rate

**Expose via API**:
```typescript
@Get('queue-stats')
async getQueueStats() {
  const [webhookQueue, indexingQueue] = await Promise.all([
    this.queueService.getQueueStats('WEBHOOK_DELIVERY'),
    this.queueService.getQueueStats('INDEX_KNOWLEDGE_BASE'),
  ]);

  return {
    webhookDelivery: webhookQueue,
    indexing: indexingQueue,
  };
}
```

---

## Chat/Message Search

### Full-Text Search
```typescript
const chats = await prisma.chat.findMany({
  where: {
    OR: [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      {
        messages: {
          some: {
            content: { contains: searchTerm, mode: 'insensitive' },
          },
        },
      },
    ],
    ...(workspaceId && { workspaceId }),
    ...(agentId && { agentId }),
  },
  include: {
    workspace: { select: { name: true } },
    agent: { select: { name: true } },
    _count: { select: { messages: true } },
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

---

## Export Functionality

### CSV Export for Audit Logs
```typescript
@Get('audit-logs/export')
async exportAuditLogs(@Query() query: AuditLogQuery) {
  const logs = await this.auditService.findAll({ ...query, limit: 10000 });
  
  const csv = logs.data.map(log => ({
    Timestamp: log.createdAt,
    Admin: log.adminUser.email,
    Action: log.action,
    Target: `${log.targetType}:${log.targetId}`,
    IP: log.ipAddress,
  }));

  return csv;
}
```

---

## Testing Checklist

### Backend
- [ ] Analytics endpoints return correct data
- [ ] Audit log filtering works
- [ ] Chat search returns relevant results
- [ ] Webhook logs display correctly
- [ ] Queue stats are accurate

### Frontend
- [ ] Analytics charts render
- [ ] Audit log table loads and filters
- [ ] Chat search works
- [ ] Webhook monitoring displays
- [ ] Grafana iframes load

---

## Performance Considerations

### Caching
- Cache analytics data (Redis, 5-minute TTL)
- Paginate large result sets
- Index frequently queried fields

### Optimization
```typescript
// Cache expensive analytics queries
const cacheKey = `analytics:agents:${period}`;
let data = await redis.get(cacheKey);

if (!data) {
  data = await this.calculateAgentPerformance(period);
  await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min
}

return JSON.parse(data);
```

---

## Monitoring Metrics

Add Prometheus metrics:
- `admin_audit_logs_total` - Counter by action type
- `admin_failed_webhooks_total` - Counter
- `admin_chat_searches_total` - Counter
- `admin_analytics_queries_duration` - Histogram

---

## Implementation Notes

1. **Start with Analytics**: Agent and conversation metrics
2. **Add Audit Viewer**: Display existing AdminAuditLog data
3. **Integrate Webhooks**: Leverage existing WebhookInvocation table
4. **Embed Grafana**: Add system health dashboards
5. **Add Search**: Implement chat/message search

This phase provides deep visibility into platform operations and admin actions.
