# Admin Dashboard - Phase 1: Foundations (Weeks 1-2)

## Overview

This phase establishes the foundational infrastructure for the admin dashboard:
- Database schema for billing, usage tracking, and admin RBAC
- Backend authentication and authorization guards
- Basic admin module structure
- Real data integration for the dashboard page

**Goal**: By end of Phase 1, admins can log in, see real platform metrics, and the foundation is ready for user/workspace management.

---

## Architecture Decision: Backend Hosting

### **Decision: Shared Backend with Network-Level Isolation**

We will use a **single NestJS backend** that serves both user API (`/api/v1/*`) and admin API (`/api/admin/*`), with network-level security isolation.

**Rationale:**
- Development speed: Single codebase, shared services, direct database access
- Security: Network isolation via separate ports + IP whitelisting
- Your stage: Admin traffic <1% of user traffic, team <10 people
- Future-proof: Code is already modular, easy to split later if needed

**Implementation:**
- Backend API: Port 4000 (serves both user and admin endpoints)
- User Frontend: Port 3000 (public)
- Admin Frontend: Port 3005 (IP-restricted)
- AdminGuard for authentication + IP validation
- Optional: Nginx reverse proxy for additional IP whitelisting

---

## Database Schema Changes

### Location
`apps/backend/prisma/schema.prisma`

### Changes Required

#### 1. Add Billing & Subscription Models

```prisma
model Plan {
  id              String         @id @default(cuid())
  name            String         // "Starter", "Pro", "Enterprise"
  priceMonthly    Float?         // null for custom enterprise plans
  priceYearly     Float?
  creditsIncluded Int            // e.g., 10_000 credits per month
  features        Json           // { "apiAccess": true, "customVoices": false }
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  subscriptions   Subscription[]
}

model Subscription {
  id               String     @id @default(cuid())
  workspaceId      String     @unique
  workspace        Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

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

  @@index([workspaceId])
  @@index([planId])
  @@index([status])
}
```

#### 2. Add Usage Tracking Model

```prisma
model UsageRecord {
  id             String     @id @default(cuid())

  workspaceId    String
  workspace      Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  agentId        String?
  agent          Agent?     @relation(fields: [agentId], references: [id], onDelete: SetNull)

  type           String     // "LLM_TOKENS" | "TTS_CHARACTERS" | "STT_SECONDS" | "CALL_MINUTES"
  provider       String     // "OPENAI", "ELEVENLABS", "DEEPGRAM", etc.
  modelUsed      String?    // "gpt-4o", "eleven_turbo_v2", etc.
  unitsConsumed  Float      // 1500 (tokens), 2500 (characters), 60 (seconds)
  costInMicroUSD Int        // Cost in millionths of USD (e.g., $0.01 = 10000)

  sessionId      String?    // Link to AgentSession or Chat for debugging

  timestamp      DateTime   @default(now())

  @@index([workspaceId, timestamp])
  @@index([type, timestamp])
  @@index([agentId, timestamp])
  @@index([provider, timestamp])
}
```

#### 3. Extend User Model for Admin RBAC

```prisma
model User {
  id               String                   @id // existing
  email            String                   @unique
  // ... all existing fields ...

  // NEW: Admin fields
  isAdmin          Boolean                  @default(false)
  adminRole        String?                  // "superadmin" | "engineer" | "support" | "finance"
  isSuspended      Boolean                  @default(false)
  suspendedAt      DateTime?
  suspensionReason String?

  // NEW: Relations
  adminAuditLogs   AdminAuditLog[]          @relation("AdminActions")
}
```

#### 4. Add Admin Audit Log Model

```prisma
model AdminAuditLog {
  id          String   @id @default(cuid())

  adminUserId String
  adminUser   User     @relation("AdminActions", fields: [adminUserId], references: [id], onDelete: Cascade)

  action      String   // "SUSPEND_USER", "VIEW_WORKSPACE", "UPDATE_PLAN", etc.
  targetType  String?  // "User" | "Workspace" | "Plan" | ...
  targetId    String?
  details     Json?    // Additional context about the action
  ipAddress   String?
  userAgent   String?

  createdAt   DateTime @default(now())

  @@index([adminUserId])
  @@index([targetType, targetId])
  @@index([createdAt])
  @@index([action])
}
```

#### 5. Add Workspace Suspension Fields

```prisma
model Workspace {
  // ... all existing fields ...

  // NEW: Suspension fields
  isSuspended      Boolean   @default(false)
  suspendedAt      DateTime?
  suspendedBy      String?   // Admin user ID
  suspensionReason String?

  // NEW: Relations
  subscription     Subscription?
  usageRecords     UsageRecord[]
}
```

#### 6. Update Agent Model

```prisma
model Agent {
  // ... all existing fields ...

  // NEW: Relation
  usageRecords UsageRecord[]
}
```

### Migration Commands

```bash
# Create migration
cd apps/backend
pnpm dlx prisma migrate dev --name add_admin_billing_models

# Generate Prisma client
pnpm dlx prisma generate
```

---

## Backend Implementation

### 1. Admin Guard

**Location**: `apps/backend/src/core/guards/admin.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check 1: User must be authenticated
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Check 2: User must be admin
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    // Check 3: User must not be suspended
    if (user.isSuspended) {
      throw new ForbiddenException('Account suspended');
    }

    // Check 4: IP whitelist (optional, for production)
    const allowedIPs = this.configService
      .get<string>('ADMIN_ALLOWED_IPS')
      ?.split(',')
      .map((ip) => ip.trim()) || [];

    if (allowedIPs.length > 0 && process.env.NODE_ENV === 'production') {
      const clientIP = this.getClientIP(request);
      const isAllowed = this.isIPAllowed(clientIP, allowedIPs);

      if (!isAllowed) {
        throw new ForbiddenException(`Access denied from IP: ${clientIP}`);
      }
    }

    return true;
  }

  private getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.ip
    );
  }

  private isIPAllowed(clientIP: string, allowedIPs: string[]): boolean {
    // Simple exact match for MVP
    // For production, use a library like 'ip-range-check' for CIDR support
    return allowedIPs.some((allowedIP) => {
      if (allowedIP.includes('/')) {
        // CIDR notation - implement or use library
        return false; // TODO: Implement CIDR matching
      }
      return clientIP === allowedIP;
    });
  }
}
```

### 2. Admin Role Guard (Optional, for role-based access)

**Location**: `apps/backend/src/core/guards/admin-role.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ADMIN_ROLES_KEY = 'adminRoles';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.adminRole) {
      throw new ForbiddenException('Admin role required');
    }

    const hasRole = requiredRoles.includes(user.adminRole) || user.adminRole === 'superadmin';

    if (!hasRole) {
      throw new ForbiddenException(`Required role: ${requiredRoles.join(' or ')}`);
    }

    return true;
  }
}

// Decorator for role-based access
export const AdminRoles = (...roles: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(ADMIN_ROLES_KEY, roles, descriptor ? descriptor.value : target);
    return descriptor || target;
  };
};
```

### 3. Admin Audit Middleware

**Location**: `apps/backend/src/core/middleware/admin-audit.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuditMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    const startTime = Date.now();

    // Only log for authenticated admin users
    if (!user?.isAdmin) {
      return next();
    }

    res.on('finish', async () => {
      try {
        // Only log successful requests and mutations
        if (res.statusCode < 400 && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
          await this.prisma.adminAuditLog.create({
            data: {
              adminUserId: user.id,
              action: `${req.method} ${req.path}`,
              targetType: this.extractTargetType(req.path),
              targetId: this.extractTargetId(req.path),
              details: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: Date.now() - startTime,
                query: req.query,
                body: this.sanitizeBody(req.body),
              },
              ipAddress: this.getClientIP(req),
              userAgent: req.headers['user-agent'] || null,
            },
          });
        }
      } catch (error) {
        // Don't fail the request if audit logging fails
        console.error('Failed to create audit log:', error);
      }
    });

    next();
  }

  private extractTargetType(path: string): string | null {
    if (path.includes('/users/')) return 'User';
    if (path.includes('/workspaces/')) return 'Workspace';
    if (path.includes('/plans/')) return 'Plan';
    if (path.includes('/subscriptions/')) return 'Subscription';
    if (path.includes('/agents/')) return 'Agent';
    return null;
  }

  private extractTargetId(path: string): string | null {
    // Match UUID or CUID patterns
    const match = path.match(/\/([a-z0-9]{20,}|[a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    
    // Remove sensitive fields
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.ip
    );
  }
}
```

### 4. Admin Module Structure

**Location**: `apps/backend/src/modules/admin/admin.module.ts`

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AdminDashboardController } from './controllers/dashboard.controller';
import { AdminDashboardService } from './services/dashboard.service';
import { AdminAuditMiddleware } from '../../core/middleware/admin-audit.middleware';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AdminAuditMiddleware).forRoutes('admin/*');
  }
}
```

### 5. Dashboard Controller

**Location**: `apps/backend/src/modules/admin/controllers/dashboard.controller.ts`

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../../core/guards/admin.guard';
import { AdminDashboardService } from '../services/dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('health')
  async getHealth() {
    return this.dashboardService.getHealth();
  }
}
```

### 6. Dashboard Service

**Location**: `apps/backend/src/modules/admin/services/dashboard.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Run queries in parallel
    const [
      totalUsers,
      newUsers30d,
      newUsers7d,
      totalWorkspaces,
      totalAgents,
      activeSessions24h,
      totalMessages,
      messagesLast24h,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.workspace.count(),
      this.prisma.agent.count(),
      this.prisma.agentSession.count({
        where: {
          createdAt: { gte: oneDayAgo },
          status: 'active',
        },
      }),
      this.prisma.message.count(),
      this.prisma.message.count({ where: { createdAt: { gte: oneDayAgo } } }),
    ]);

    // Calculate trends
    const userGrowthRate = totalUsers > 0 ? ((newUsers30d / totalUsers) * 100).toFixed(1) : '0.0';

    return {
      users: {
        total: totalUsers,
        new30d: newUsers30d,
        new7d: newUsers7d,
        growthRate: parseFloat(userGrowthRate),
      },
      workspaces: {
        total: totalWorkspaces,
      },
      agents: {
        total: totalAgents,
        active24h: activeSessions24h,
      },
      messages: {
        total: totalMessages,
        last24h: messagesLast24h,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getHealth() {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
```

---

## Frontend Implementation

### Next.js API Proxy Configuration (Optional for Production)

For production, you can proxy API requests through Next.js to avoid CORS issues:

**Location**: `apps/frontend/next.config.js`

```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.BACKEND_URL || 'http://localhost:4000/api/:path*',
      },
    ];
  },
};
```

Then in your frontend code, you can use relative URLs like `/api/admin/dashboard/stats` instead of absolute URLs.

### Update Dashboard Page

**Location**: `apps/frontend/src/app/(admin)/page.tsx`

```typescript
"use client"

import { useEffect, useState } from "react"
import { StatCard } from "../../../../libs/shadcn-ui/src/components/admin/shared/StatCard"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { 
  Users, 
  UserPlus, 
  Building2,
  MessageSquare,
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react"

interface DashboardStats {
  users: {
    total: number;
    new30d: number;
    new7d: number;
    growthRate: number;
  };
  workspaces: {
    total: number;
  };
  agents: {
    total: number;
    active24h: number;
  };
  messages: {
    total: number;
    last24h: number;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Backend runs on port 4000
      const response = await fetch('http://localhost:4000/api/admin/dashboard/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>Error loading dashboard: {error}</span>
          </div>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Core Platform Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={stats.users.total.toLocaleString()}
            icon={Users}
            trend={{ value: stats.users.growthRate, label: "growth rate" }}
            iconClassName="bg-blue-100 text-blue-600"
          />
          <StatCard
            title="New Users (7d)"
            value={stats.users.new7d.toLocaleString()}
            icon={UserPlus}
            trend={{ value: stats.users.new30d, label: "last 30 days" }}
            iconClassName="bg-purple-100 text-purple-600"
          />
          <StatCard
            title="Workspaces"
            value={stats.workspaces.total.toLocaleString()}
            icon={Building2}
            iconClassName="bg-green-100 text-green-600"
          />
          <StatCard
            title="Total Agents"
            value={stats.agents.total.toLocaleString()}
            icon={MessageSquare}
            trend={{ value: stats.agents.active24h, label: "active (24h)" }}
            iconClassName="bg-violet-100 text-violet-600"
          />
        </div>
      </div>

      {/* Activity Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity (Last 24h)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Messages"
            value={stats.messages.last24h.toLocaleString()}
            icon={Activity}
            iconClassName="bg-indigo-100 text-indigo-600"
          />
          <StatCard
            title="Active Sessions"
            value={stats.agents.active24h.toLocaleString()}
            icon={CheckCircle2}
            iconClassName="bg-cyan-100 text-cyan-600"
          />
        </div>
      </div>

      {/* System Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm text-gray-700">All systems operational</span>
        </div>
      </Card>
    </div>
  );
}
```

---

## Environment Variables

**Location**: `apps/backend/.env`

Add these new variables:

```bash
# Backend
PORT=4000

# Admin Security
ADMIN_ALLOWED_IPS=  # Comma-separated list, e.g., "203.0.113.0/24,10.0.0.0/8"

# Frontend URLs
USER_FRONTEND_URL=http://localhost:3000  # Development
ADMIN_FRONTEND_URL=http://localhost:3005  # Development
# USER_FRONTEND_URL=https://app.jibu.ai  # Production
# ADMIN_FRONTEND_URL=https://admin.jibu.ai  # Production
```

---

## Testing Checklist

### Database Migration
- [ ] Run migration successfully
- [ ] Verify all new tables created
- [ ] Verify indexes created
- [ ] Test rollback if needed

### Backend
- [ ] AdminGuard blocks non-admin users
- [ ] AdminGuard allows admin users
- [ ] IP whitelist works (if configured)
- [ ] Dashboard stats endpoint returns data
- [ ] Health endpoint returns status
- [ ] Audit middleware logs admin actions

### Frontend
- [ ] Dashboard loads without errors
- [ ] Real stats display correctly
- [ ] Loading state shows
- [ ] Error state shows on API failure
- [ ] Stats refresh on page load

---

## Deployment Steps

### 1. Database Migration
```bash
cd apps/backend
pnpm dlx prisma migrate deploy
```

### 2. Seed Initial Data (Optional)
```bash
# Create a seed script to add your first admin user
pnpm dlx prisma db seed
```

### 3. Update Main App Module
```typescript
// apps/backend/src/app.module.ts
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // ... existing imports
    AdminModule,
  ],
})
export class AppModule {}
```

### 4. Test Locally
```bash
# Start backend (port 4000)
nx serve backend

# Start user frontend (port 3000)
nx serve frontend

# Start admin frontend (port 3005)
nx serve frontend --configuration=admin

# Test admin endpoints
curl http://localhost:4000/api/admin/dashboard/stats

# Access frontends
# User: http://localhost:3000
# Admin: http://localhost:3005
```

---

## Success Criteria

- ✅ Database migration completes without errors
- ✅ AdminGuard successfully protects admin routes
- ✅ Dashboard shows real metrics from database
- ✅ Admin actions are logged to AdminAuditLog
- ✅ Non-admin users cannot access admin endpoints
- ✅ Frontend displays loading and error states properly

---

## Next Steps (Phase 2)

Once Phase 1 is complete, you'll be ready to implement:
- User management (list, search, view, suspend)
- Workspace management (list, search, view details)
- More detailed analytics

---

## Troubleshooting

### Migration Fails
```bash
# Reset database (development only!)
pnpm dlx prisma migrate reset

# Or create a new migration
pnpm dlx prisma migrate dev --create-only
```

### AdminGuard Not Working
- Check that user has `isAdmin: true` in database
- Verify JWT token includes user data
- Check that AdminGuard is applied to controller

### Stats Not Loading
- Check database connection
- Verify Prisma client is generated
- Check browser console for errors
- Verify API endpoint is accessible
