# Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
# SPDX-License-Identifier: AGPL-3.0-only
# syntax=docker/dockerfile:1

# ── base: node + pnpm (version pinned by package.json packageManager) ────────
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HUSKY=0
RUN corepack enable

# ── pruner: reduce the monorepo to what `web` needs ──────────────────────────
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2.10.3 prune web --docker

# ── builder: install, build the whole graph, emit standalone output ──────────
FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo build --filter=web

# ── runner: standalone server + static assets + migrations, non-root ─────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG FORMSMITH_VERSION=dev
ENV FORMSMITH_VERSION=$FORMSMITH_VERSION
# fs reads aren't traced into standalone output — ship the SQL at a fixed path
ENV FORMSMITH_MIGRATIONS_DIR=/app/drizzle

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder /repo/packages/db/drizzle ./drizzle

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
