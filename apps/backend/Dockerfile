FROM node:20-alpine AS base

# Prisma's query engine needs openssl on Alpine.
RUN apk add --no-cache openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# apps/backend has no package.json of its own — it's a plain source dir
# consumed through the root workspace's node_modules via Nx, not an
# independent pnpm package. Only the root manifests are needed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# Build the source code
FROM base AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma client inside the build (must run on the same libc
# family — musl/Alpine — as the runtime image, not on the host machine).
RUN pnpm exec prisma generate --schema=./apps/backend/prisma/schema.prisma

# webpack's externalDependencies: 'none' bundles the app, but a handful of
# packages (better-auth + its deps, zod, kysely, jose) are deliberately kept
# external per apps/backend/webpack.config.js — the runtime image still
# needs node_modules for those.
RUN pnpm exec nx build backend --configuration=production

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 backend

COPY --from=builder --chown=backend:nodejs /app/dist/apps/backend ./
COPY --from=builder --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/package.json ./package.json

USER backend

EXPOSE 4000

# GET /api/health is a plain liveness check (no DB/Redis dependency) — see
# apps/backend/src/app/app.controller.ts.
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=20s \
  CMD wget --spider -q http://localhost:4000/api/health || exit 1

CMD ["node", "main.js"]
