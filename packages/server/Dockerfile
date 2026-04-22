FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

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
EXPOSE 8070
CMD ["node", "src/index.ts"]
