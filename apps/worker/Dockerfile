FROM node:20-alpine AS base

# Prisma's query engine needs openssl on Alpine (worker uses PrismaService
# transitively via apps/backend/src/core/database).
RUN apk add --no-cache openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Pin pnpm via corepack (matches packageManager in root package.json)
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# apps/worker and libs/queue-definitions have no package.json of their own —
# they're plain source dirs consumed through the root workspace's
# node_modules via Nx path mapping, not independent pnpm packages. Only the
# root manifests are needed to install the full workspace.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# Generate the Prisma client — the worker pulls in PrismaService transitively
# (apps/worker/src/queue/queue.module.ts imports it from apps/backend/src),
# so it needs the same generated client the backend does. Must run on the
# same libc family (musl/Alpine) as the runtime image.
COPY apps/backend/prisma ./apps/backend/prisma
RUN pnpm exec prisma generate --schema=./apps/backend/prisma/schema.prisma

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

COPY --from=deps --chown=worker:nodejs /app/node_modules ./node_modules
COPY --chown=worker:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY --chown=worker:nodejs apps/worker ./apps/worker
COPY --chown=worker:nodejs apps/backend/src ./apps/backend/src
COPY --chown=worker:nodejs libs/queue-definitions ./libs/queue-definitions
COPY --chown=worker:nodejs libs/cache-utils ./libs/cache-utils

# The worker's Nx "build" target (tsc -p apps/worker/tsconfig.json) does NOT
# rewrite @jibu/*, @backend/*, @worker/* path aliases into real paths — they
# stay as literal `require('@jibu/queue-definitions')` in the compiled JS,
# which plain `node` cannot resolve. The only invocation actually proven to
# work anywhere in this repo (apps/worker/project.json's "worker" target,
# used by both bare-process dev and ecosystem.config.js) runs the TS source
# directly through ts-node with tsconfig-paths registered — so this image
# does the same rather than shipping an unproven "compiled" runtime. This is
# real technical debt in the worker's own build pipeline (tsc output has
# never been runnable standalone, containerized or not), not something
# specific to Docker — fixing it properly means migrating the worker to a
# bundler (webpack, like the backend) or adding tsc-alias to the build.
USER worker

# No HTTP listener (BullMQ queue consumer, not a server) — no HEALTHCHECK;
# rely on `restart: unless-stopped` + Docker's process-exit detection.

CMD ["node_modules/.bin/ts-node", "-r", "tsconfig-paths/register", "--project", "apps/worker/tsconfig.worker.json", "apps/worker/src/main.ts"]
