FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build the Vue frontend. Its static output is served by the Fastify server,
# so there is no separate frontend / nginx image.
FROM base AS app-builder
WORKDIR /app
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/app/package.json ./packages/app/package.json
# app depends on @packages/server (workspace:*) for shared types
COPY packages/server/package.json ./packages/server/package.json
COPY packages/domain/package.json ./packages/domain/package.json
RUN pnpm install --frozen-lockfile
COPY packages/app ./packages/app
COPY packages/server ./packages/server
COPY packages/domain ./packages/domain
RUN pnpm --filter @packages/app exec vite build

# Install deps for the full workspace (needed for pnpm deploy)
FROM base AS installer
WORKDIR /app
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/package.json
COPY packages/domain/package.json ./packages/domain/package.json
RUN pnpm install --frozen-lockfile
COPY packages/server ./packages/server
COPY packages/domain ./packages/domain

# pnpm deploy produces a self-contained dir with only production deps
RUN pnpm --filter @packages/server deploy --prod --legacy /deploy

FROM base AS runner
WORKDIR /app
COPY --from=installer /deploy .
# Committed SQL migrations, applied at deploy time via `node src/migrate.ts`
COPY --from=installer /app/packages/server/drizzle ./drizzle
# Built frontend, served as static files by Fastify (see app.ts)
COPY --from=app-builder /app/packages/app/dist ./public
EXPOSE 8070
CMD ["node", "src/index.ts"]
