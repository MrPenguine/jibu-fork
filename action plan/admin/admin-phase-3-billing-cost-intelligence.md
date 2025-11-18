# Admin Dashboard - Phase 3: Billing & Cost Intelligence (Weeks 5-6)

## Overview

Implement billing management and cost tracking capabilities.

**Prerequisites**: Phase 1-2 complete

**Deliverables**:
- Plan management (CRUD)
- Subscription management
- Usage tracking integration
- Cost analytics dashboard
- Revenue metrics (MRR/ARR)

---

## Backend Services

### Plan Management Service
**Location**: `apps/backend/src/modules/admin/services/plans.service.ts`

Key methods:
- `create(dto)` - Create new plan
- `findAll()` - List all plans
- `findOne(id)` - Plan details
- `update(id, dto)` - Update plan
- `deactivate(id)` - Soft delete plan

### Subscription Management Service
**Location**: `apps/backend/src/modules/admin/services/subscriptions.service.ts`

Key methods:
- `findAll(query)` - List subscriptions with filters
- `findOne(id)` - Subscription details
- `create(workspaceId, planId)` - Create subscription
- `update(id, dto)` - Update subscription
- `cancel(id)` - Cancel subscription

### Usage Tracking Service
**Location**: `apps/backend/src/modules/admin/services/usage.service.ts`

Key methods:
- `recordUsage(dto)` - Create usage record
- `getWorkspaceUsage(workspaceId, period)` - Workspace usage
- `getProviderCosts(period)` - Cost by provider
- `getTopWorkspaces(limit)` - Most expensive workspaces

### Analytics Service
**Location**: `apps/backend/src/modules/admin/services/analytics.service.ts`

Key methods:
- `getRevenueMetrics(period)` - MRR, ARR calculations
- `getCostBreakdown(period)` - Costs by provider/type
- `getMarginAnalysis()` - Profit margins per workspace

---

## API Endpoints

### Plans
- `GET /api/admin/plans` - List plans
- `POST /api/admin/plans` - Create plan
- `GET /api/admin/plans/:id` - Plan details
- `PATCH /api/admin/plans/:id` - Update plan
- `DELETE /api/admin/plans/:id` - Deactivate plan

### Subscriptions
- `GET /api/admin/subscriptions` - List subscriptions
- `POST /api/admin/subscriptions` - Create subscription
- `GET /api/admin/subscriptions/:id` - Details
- `PATCH /api/admin/subscriptions/:id` - Update
- `DELETE /api/admin/subscriptions/:id` - Cancel

### Analytics
- `GET /api/admin/analytics/revenue` - Revenue metrics
- `GET /api/admin/analytics/costs` - Cost breakdown
- `GET /api/admin/analytics/margins` - Margin analysis
- `GET /api/admin/analytics/top-workspaces` - Top spenders

---

## Usage Tracking Integration

### Instrument Existing Code

Add usage recording to:

1. **LLM Calls** (Message creation)
```typescript
// After OpenAI/Anthropic API call
await usageService.recordUsage({
  workspaceId,
  agentId,
  type: 'LLM_TOKENS',
  provider: 'OPENAI',
  modelUsed: 'gpt-4o',
  unitsConsumed: tokensUsed,
  costInMicroUSD: calculateCost(tokensUsed, 'gpt-4o'),
  sessionId: chatId,
});
```

2. **TTS Calls** (Text-to-Speech)
```typescript
await usageService.recordUsage({
  workspaceId,
  type: 'TTS_CHARACTERS',
  provider: 'ELEVENLABS',
  unitsConsumed: text.length,
  costInMicroUSD: calculateTTSCost(text.length),
});
```

3. **STT Calls** (Speech-to-Text)
```typescript
await usageService.recordUsage({
  workspaceId,
  type: 'STT_SECONDS',
  provider: 'DEEPGRAM',
  unitsConsumed: audioLengthSeconds,
  costInMicroUSD: calculateSTTCost(audioLengthSeconds),
});
```

4. **Call Minutes**
```typescript
await usageService.recordUsage({
  workspaceId,
  agentId,
  type: 'CALL_MINUTES',
  provider: 'TWILIO',
  unitsConsumed: durationMinutes,
  costInMicroUSD: calculateCallCost(durationMinutes),
  sessionId: agentSessionId,
});
```

---

## Frontend Pages

### Billing Dashboard
**Location**: `apps/frontend/src/app/(admin)/billing/page.tsx`

**Tabs**:
1. **Revenue**
   - MRR/ARR charts
   - Active subscriptions by plan
   - Growth trends

2. **Costs**
   - Cost by provider (pie chart)
   - Cost trends over time
   - Top 10 workspaces by cost

3. **Plans**
   - List of plans
   - Create/edit plan modal
   - Subscription counts per plan

### Plan Management Modal
Features:
- Create new plan
- Edit existing plan
- Set pricing (monthly/yearly)
- Configure features (JSON)
- Set credit limits

---

## Stripe Integration (Optional)

### Webhook Handler
**Location**: `apps/backend/src/modules/admin/controllers/stripe-webhook.controller.ts`

Handle events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Sync Service
Background job to sync Stripe subscriptions with database.

---

## Seed Data

### Default Plans
```typescript
// apps/backend/prisma/seed.ts
const plans = [
  {
    name: 'Starter',
    priceMonthly: 29,
    priceYearly: 290,
    creditsIncluded: 10000,
    features: {
      apiAccess: true,
      customVoices: false,
      maxAgents: 5,
    },
  },
  {
    name: 'Pro',
    priceMonthly: 99,
    priceYearly: 990,
    creditsIncluded: 50000,
    features: {
      apiAccess: true,
      customVoices: true,
      maxAgents: 20,
    },
  },
  {
    name: 'Enterprise',
    priceMonthly: null, // Custom pricing
    priceYearly: null,
    creditsIncluded: 500000,
    features: {
      apiAccess: true,
      customVoices: true,
      maxAgents: -1, // Unlimited
      dedicatedSupport: true,
    },
  },
];
```

---

## Cost Calculation Helpers

**Location**: `apps/backend/src/modules/admin/utils/cost-calculator.ts`

```typescript
export const PRICING = {
  OPENAI: {
    'gpt-4o': { input: 5, output: 15 }, // per 1M tokens
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  },
  ELEVENLABS: {
    characters: 0.3, // per 1000 characters
  },
  DEEPGRAM: {
    seconds: 0.0043, // per second
  },
  TWILIO: {
    minutes: 0.0085, // per minute
  },
};

export function calculateLLMCost(
  tokens: number,
  model: string,
  type: 'input' | 'output'
): number {
  const price = PRICING.OPENAI[model]?.[type] || 0;
  return Math.round((tokens / 1000000) * price * 1000000); // microUSD
}
```

---

## Testing Checklist

### Backend
- [ ] Plan CRUD operations work
- [ ] Subscription creation/updates work
- [ ] Usage records are created correctly
- [ ] Cost calculations are accurate
- [ ] Analytics endpoints return correct data
- [ ] Revenue metrics calculated correctly

### Frontend
- [ ] Billing dashboard loads
- [ ] Revenue charts display
- [ ] Cost breakdown shows
- [ ] Plan management works
- [ ] Subscription list displays

---

## Monitoring

Add Prometheus metrics:
- `admin_usage_records_total` - Counter
- `admin_revenue_mrr` - Gauge
- `admin_costs_by_provider` - Gauge
- `admin_active_subscriptions` - Gauge

---

## Implementation Notes

1. **Start with Plans**: Create plan management first
2. **Add Subscriptions**: Link workspaces to plans
3. **Instrument Usage**: Add tracking to existing services
4. **Build Analytics**: Aggregate usage data
5. **Create Dashboard**: Visualize metrics

This phase enables monetization and cost visibility.
