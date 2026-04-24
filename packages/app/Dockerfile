FROM node:24-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/app/package.json ./packages/app/package.json
# app depends on @packages/server (workspace:*) for shared types
COPY packages/server/package.json ./packages/server/package.json
RUN pnpm install --frozen-lockfile

COPY packages/app ./packages/app
COPY packages/server ./packages/server
RUN pnpm --filter @packages/app exec vite build

FROM nginx:alpine AS runner
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
