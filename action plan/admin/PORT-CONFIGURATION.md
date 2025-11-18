# Port Configuration - Jibu Console

## Development Ports

### Applications
- **Backend API**: `4000` (serves both `/api/v1/*` and `/api/admin/*`)
- **Worker**: `4001` (background job processing)
- **User Frontend**: `3000` (public-facing dashboard)
- **Admin Frontend**: `3005` (internal admin dashboard)

### Infrastructure Services
- **PostgreSQL**: `5432`
- **Redis**: `6379`
- **Qdrant**: `6333` (HTTP), `6334` (gRPC)
- **Vault**: `8200`
- **LiveKit**: `7880` (HTTP), `7881` (HTTPS), `7882` (UDP), `6789` (Prometheus)
- **N8N**: `5678`
- **Prometheus**: `9090`
- **Grafana**: `3100` (mapped from container port 3000)

---

## Starting Services

### Backend
```bash
# Development
nx serve backend
# Runs on http://localhost:4000

# API endpoints:
# - User API: http://localhost:4000/api/v1/*
# - Admin API: http://localhost:4000/api/admin/*
# - Swagger: http://localhost:4000/api/docs
```

### Frontend - User Dashboard
```bash
# Development
nx serve frontend
# Runs on http://localhost:3000
```

### Frontend - Admin Dashboard
```bash
# Development
nx serve frontend --configuration=admin
# Runs on http://localhost:3005
```

### Worker
```bash
# Development
nx run worker:worker
# Runs on port 4001 (if configured)
```

### Infrastructure
```bash
# Start all infrastructure services
docker-compose up -d

# Services will be available on their respective ports
```

---

## API Endpoint Examples

### User API (Public)
```bash
# From user frontend (port 3000)
curl http://localhost:4000/api/v1/workspaces
curl http://localhost:4000/api/v1/agents
curl http://localhost:4000/api/v1/chats
```

### Admin API (Protected)
```bash
# From admin frontend (port 3005)
curl http://localhost:4000/api/admin/dashboard/stats
curl http://localhost:4000/api/admin/users
curl http://localhost:4000/api/admin/workspaces
```

---

## Frontend API Configuration

### Development (Direct Backend Calls)
```typescript
// In admin frontend code
const response = await fetch('http://localhost:4000/api/admin/dashboard/stats');
```

### Production (Using Next.js Proxy)
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

Then use relative URLs:
```typescript
// In admin frontend code (with proxy)
const response = await fetch('/api/admin/dashboard/stats');
```

---

## CORS Configuration

The backend already has CORS enabled for frontend URLs:

**Location**: `apps/backend/src/main.ts`

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
});
```

### Environment Variables
```bash
# Development
FRONTEND_URL=http://localhost:3000,http://localhost:3005

# Production
FRONTEND_URL=https://app.jibu.ai,https://admin.jibu.ai
```

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Development Setup                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Frontend (3000)  ──┐                                   │
│                          │                                   │
│  Admin Frontend (3005) ──┼──> Backend API (4000)            │
│                          │      │                            │
│                          │      ├─> /api/v1/* (public)      │
│                          │      └─> /api/admin/* (protected)│
│                          │                                   │
│                          └──> Worker (4001)                  │
│                                                               │
│  Infrastructure:                                              │
│  ├─ PostgreSQL (5432)                                        │
│  ├─ Redis (6379)                                             │
│  ├─ Qdrant (6333)                                            │
│  ├─ Grafana (3100)                                           │
│  └─ Prometheus (9090)                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Production Deployment

### Option 1: Separate Domains
```
User Frontend:  https://app.jibu.ai (port 443)
Admin Frontend: https://admin.jibu.ai (port 443)
Backend API:    https://api.jibu.ai (port 443)
                ├─> /api/v1/* (public)
                └─> /api/admin/* (IP-restricted)
```

### Option 2: Subpaths
```
User Frontend:  https://jibu.ai (port 443)
Admin Frontend: https://jibu.ai/admin (port 443)
Backend API:    https://jibu.ai/api (port 443)
                ├─> /api/v1/* (public)
                └─> /api/admin/* (IP-restricted)
```

---

## Security Considerations

### Admin API Protection
1. **AdminGuard**: Checks `user.isAdmin === true`
2. **IP Whitelisting**: Optional via `ADMIN_ALLOWED_IPS` env var
3. **Rate Limiting**: Apply to admin endpoints
4. **Audit Logging**: All admin actions logged

### Environment Variables for Security
```bash
# Admin IP whitelist (comma-separated)
ADMIN_ALLOWED_IPS=203.0.113.0/24,10.0.0.0/8

# Or leave empty to disable IP checking in development
ADMIN_ALLOWED_IPS=
```

---

## Troubleshooting

### Backend not accessible
```bash
# Check if backend is running
curl http://localhost:4000/api/docs

# Check environment
echo $PORT  # Should be 4000 or empty (defaults to 4000)
```

### Frontend can't reach backend
```bash
# Check CORS configuration
# Ensure FRONTEND_URL includes both ports
FRONTEND_URL=http://localhost:3000,http://localhost:3005

# Or use Next.js proxy (see above)
```

### Admin frontend on wrong port
```bash
# Use the admin configuration
nx serve frontend --configuration=admin

# Should start on port 3005
```

### Port already in use
```bash
# Find process using port
# Windows
netstat -ano | findstr :4000

# Kill process
taskkill /PID <PID> /F

# Or change port in .env
PORT=4001
```

---

## Quick Reference

| Service | Port | Access | Purpose |
|---------|------|--------|---------|
| Backend | 4000 | Public + Admin | Main API server |
| Worker | 4001 | Internal | Background jobs |
| User Frontend | 3000 | Public | User dashboard |
| Admin Frontend | 3005 | Internal | Admin dashboard |
| PostgreSQL | 5432 | Internal | Database |
| Redis | 6379 | Internal | Cache & queues |
| Grafana | 3100 | Internal | Monitoring |
| Prometheus | 9090 | Internal | Metrics |

---

**Last Updated**: 2025-11-17
