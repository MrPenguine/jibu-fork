FROM python:3.11-slim AS base

RUN pip install --no-cache-dir poetry==1.8.3

FROM base AS deps
WORKDIR /app

# package-mode = false in pyproject.toml — this is an application, not a
# publishable package, so --no-root skips trying to install itself.
COPY apps/livekit-agent/pyproject.toml apps/livekit-agent/poetry.lock ./
RUN poetry config virtualenvs.create false \
  && poetry install --no-root --only main

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 agent && adduser --system --uid 1001 --gid 1001 agent

COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY apps/livekit-agent/src ./src

USER agent

# No HTTP listener — this is a LiveKit Agents SDK worker that connects
# outbound to the LiveKit server, not a server itself. No HEALTHCHECK;
# rely on `restart: unless-stopped` + Docker's process-exit detection.

# 'start' is the SDK's production mode — 'dev' (used for bare-process local
# dev via ecosystem.config.js) is hot-reload/watch mode and has no benefit
# in a container.
CMD ["python", "src/main.py", "start"]
