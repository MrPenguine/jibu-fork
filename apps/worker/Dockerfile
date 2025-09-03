FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY libs/queue-definitions/package.json ./libs/queue-definitions/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the worker app
RUN npm install -g nx
RUN nx build worker --prod

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker
USER worker

# Copy necessary files
COPY --from=builder --chown=worker:nodejs /app/dist/apps/worker ./
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/package.json ./package.json

# Set environment variables
ENV PORT 3100
ENV REDIS_HOST redis
ENV REDIS_PORT 6379
ENV N8N_API_URL http://n8n:5678/api/v1

# Expose the port
EXPOSE 3100

# Start the worker
CMD ["node", "main.js"]
