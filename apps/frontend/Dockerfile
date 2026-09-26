FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# Build the source code
FROM base AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time, not
# read at runtime — they must come in as build args, not just `environment:`
# in compose. NEXT_PUBLIC_API_URL is what the BROWSER calls, so it should
# stay a published host port (localhost:4000) even for a containerized
# frontend — the browser runs on the host, not inside the Compose network.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_BASE_URL=http://localhost:3000
ARG NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL=http://localhost:5678
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL=$NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL

# @nx/next:build with the production configuration and next.config.js's
# output:'standalone' copies .next/standalone, .next/static, and public
# into the Nx outputPath (dist/apps/frontend) — verify this exact layout on
# the first real build; Nx's standalone-copy behavior can shift by version.
RUN pnpm exec nx build frontend --configuration=production

# Production image — standalone output only, no full node_modules/toolchain.
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/dist/apps/frontend/public ./apps/frontend/public

USER nextjs

EXPOSE 3000

# GET /api/health — a dedicated dependency-free route (no upstream check;
# see apps/frontend/src/app/api/health/route.ts), cheaper than probing '/'.
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=20s \
  CMD wget --spider -q http://localhost:3000/api/health || exit 1

CMD ["node", "apps/frontend/server.js"]
