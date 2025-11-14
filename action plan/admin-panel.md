# Aura Control Center - Implementation Guide

## Directory Structure

Create this structure in your project:

```
apps/frontend/src/app/
├── (dashboard)/              # User dashboard (existing)
└── (admin)/                  # Admin dashboard (NEW)
    ├── layout.tsx
    ├── page.tsx              # Main Dashboard (Cockpit View)
    ├── users/
    │   ├── page.tsx          # User table
    │   └── [id]/
    │       └── page.tsx      # User detail view
    ├── workspaces/
    │   ├── page.tsx          # Workspace table
    │   └── [id]/
    │       └── page.tsx      # Workspace detail view
    ├── billing/
    │   └── page.tsx          # Billing & Finance dashboard
    ├── credentials/
    │   └── page.tsx          # Platform Credentials
    ├── analytics/
    │   └── page.tsx          # Analytics dashboard
    ├── logs/
    │   └── page.tsx          # System Logs & Monitoring
    └── settings/
        └── page.tsx          # Settings & RBAC

libs/shadcn-ui/src/components/
└── admin/                    # NEW admin components
    ├── PlatformAdminSidebar.tsx
    ├── dashboard/
    │   ├── MetricCard.tsx
    │   ├── RevenueChart.tsx
    │   ├── ActivityFeed.tsx
    │   └── SystemHealthWidget.tsx
    ├── users/
    │   └── UserTable.tsx
    └── shared/
        └── StatCard.tsx
```

## Commands to Create Structure

```bash
# Navigate to frontend app directory
cd apps/frontend/src/app

# Create (admin) layout group
mkdir -p "(admin)/users/[id]"
mkdir -p "(admin)/workspaces/[id]"
mkdir -p "(admin)/billing"
mkdir -p "(admin)/credentials"
mkdir -p "(admin)/analytics"
mkdir -p "(admin)/logs"
mkdir -p "(admin)/settings"

# Create admin components library
cd ../../../../libs/shadcn-ui/src/components
mkdir -p admin/dashboard
mkdir -p admin/users
mkdir -p admin/shared
```

## Implementation Order

1. ✅ Create directory structure (above)
2. 🔄 PlatformAdminSidebar component
3. 🔄 Admin layout with middleware guard
4. 🔄 Main Dashboard (Cockpit View)
5. ⏳ User Management
6. ⏳ Workspace Management
7. ⏳ Billing & Finance
8. ⏳ Platform Credentials
9. ⏳ Analytics
10. ⏳ System Logs
11. ⏳ Settings & RBAC

---

## ✅ Files Created

All files have been created! Here's what's ready:

### Core Structure
- ✅ `libs/shadcn-ui/src/components/admin/PlatformAdminSidebar.tsx` - Admin sidebar with navigation
- ✅ `libs/shadcn-ui/src/components/admin/shared/StatCard.tsx` - Reusable metric card component
- ✅ `apps/frontend/src/app/(admin)/layout.tsx` - Admin layout with auth guard

### Pages
- ✅ `apps/frontend/src/app/(admin)/page.tsx` - **Main Dashboard (Cockpit View)** with mock data
- ✅ `apps/frontend/src/app/(admin)/credentials/page.tsx` - **Platform Credentials** (fully functional UI)
- ✅ `apps/frontend/src/app/(admin)/users/page.tsx` - User Management (placeholder)
- ✅ `apps/frontend/src/app/(admin)/workspaces/page.tsx` - Workspace Management (placeholder)
- ✅ `apps/frontend/src/app/(admin)/billing/page.tsx` - Billing & Finance (placeholder)
- ✅ `apps/frontend/src/app/(admin)/analytics/page.tsx` - Analytics (placeholder)
- ✅ `apps/frontend/src/app/(admin)/logs/page.tsx` - System Logs (placeholder)
- ✅ `apps/frontend/src/app/(admin)/settings/page.tsx` - Settings (placeholder)

---

## 🚀 How to Test

### Option A: Admin Dashboard on Port 3005 (Recommended)

```bash
# From project root
pnpm run dev:admin
```

Then navigate to:
```
http://localhost:3005
```

**Important:** The `(admin)` folder is a Next.js route group - it doesn't add `/admin` to the URL. The routes are:
- `http://localhost:3005/` → Cockpit View (main dashboard)
- `http://localhost:3005/credentials` → Platform Credentials
- `http://localhost:3005/users` → User Management
- `http://localhost:3005/workspaces` → Workspace Management
- etc.

### Option B: Same Port as User Dashboard (Port 3000)

```bash
# From project root
pnpm run dev
```

Then navigate to:
```
http://localhost:3000
```

**Note:** Both options serve the same Next.js app, but the admin configuration runs on port 3005 for separation. When running on port 3000, you'll see both user dashboard routes (`/workspace/*`) and admin routes (`/credentials`, `/users`, etc.).

### 3. What You'll See

**Main Dashboard (Cockpit View):**
- Core Business Metrics (MRR, Active Subscriptions, New Signups, Churn Rate)
- Platform Usage (Active Agents, Conversation Minutes, API Calls, Avg Duration)
- System Health widget with API latency, error rate, and third-party service status
- Recent Activity Feed with live updates

**Platform Credentials:**
- Table of all platform credentials with provider badges
- Show/hide API keys functionality
- Add Credential dialog (UI only, not connected to backend yet)
- Status badges (Active/Inactive)

**Other Pages:**
- "Coming Soon" placeholders with descriptions of planned features

---

## 🎨 UI Features

### Design System
- **Color Scheme:** Violet/Purple gradient for admin branding
- **Icons:** Lucide React icons throughout
- **Components:** All using your existing shadcn-ui components
- **Responsive:** Mobile-friendly grid layouts

### Navigation
- **Sidebar Sections:**
  - Cockpit View (main dashboard)
  - Management (Users, Workspaces, Billing)
  - Platform (Credentials, Analytics, Logs)
  - Settings
- **Back to Workspace** button to return to user dashboard

### Mock Data
All data is currently hardcoded for visualization:
- Metrics with trend indicators
- Service health status
- Recent activity feed
- Platform credentials

---

## 🔄 Next Steps

### Phase 1: Backend Integration (After Visualization)

1. **Apply Database Schema Changes**
   ```bash
   # Add isPlatformAdmin and PlatformCredential model
   pnpm nx run backend:prisma:migrate dev --name add_platform_admin
   ```

2. **Set Yourself as Platform Admin**
   ```sql
   UPDATE "User" SET "isPlatformAdmin" = true WHERE email = 'your-email@example.com';
   ```

3. **Implement Backend Module**
   - Create `apps/backend/src/modules/v1/platform-admin/`
   - Add PlatformAdminService, Controller, DTOs
   - Implement CRUD endpoints for credentials

4. **Connect Frontend to Backend**
   - Replace mock data with real API calls
   - Implement credential encryption/decryption
   - Add error handling and loading states

5. **Uncomment Auth Guards**
   - In `apps/frontend/src/app/(admin)/layout.tsx`
   - Uncomment the `isPlatformAdmin` check to enforce access control

### Phase 2: Build Out Features

Work through each section in priority order:
1. ✅ Credentials (UI done, needs backend)
2. Users Management
3. Workspace Management
4. Billing & Finance
5. Analytics
6. System Logs
7. Settings & RBAC

---

## 📝 Notes

- **Auth Guard:** Currently commented out in layout.tsx - will redirect non-admins once backend is ready
- **Mock Data:** All metrics and data are hardcoded - replace with API calls
- **Styling:** Uses your existing shadcn-ui components and Tailwind classes
- **Icons:** All Lucide React icons are already imported

---

## 🐛 Troubleshooting

### Import Errors
```bash
# Make sure all dependencies are installed
pnpm install
```

### Backend Connection Errors (ECONNREFUSED)
The admin dashboard currently uses **mock data only** and doesn't require the backend to be running.

If you see `ECONNREFUSED` errors:
- ✅ **This is expected** - the admin layout has been configured to use mock data
- ✅ The backend API call is commented out in `apps/frontend/src/app/(admin)/layout.tsx`
- ✅ Mock admin user is used: `Platform Admin (admin@jibu.ai)`

### 404 Error on `/admin`
If you get a 404 when navigating to `/admin`:
1. **Stop the dev server** (Ctrl+C)
2. **Clear Next.js cache:**
   ```bash
   # From project root
   rm -rf apps/frontend/.next
   # Or on Windows:
   rmdir /s /q apps\frontend\.next
   ```
3. **Restart the dev server:**
   ```bash
   pnpm run dev:admin
   ```

### Admin Route Not Loading
- Check that the `(admin)` directory was created correctly in `apps/frontend/src/app/`
- Verify all files are in the right locations
- Make sure the directory name includes parentheses: `(admin)` not `admin`
- Restart the dev server

---

## 🎉 What's Working Now

You can now:
- ✅ Navigate to `http://localhost:3005/` and see the Cockpit View dashboard
- ✅ View all metrics and widgets with mock data
- ✅ Browse to `/credentials` and see the credentials management UI
- ✅ Click through all navigation items (`/users`, `/workspaces`, `/billing`, etc.)
- ✅ See the "Coming Soon" placeholders for other features
- ✅ Use the "Back to Workspace" button to return to user dashboard

**Remember:** Route groups `(admin)` don't add `/admin` to URLs - they're just for organization!

The UI is fully functional and ready for you to visualize the admin panel structure!
