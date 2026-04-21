# Deployment Plan

## Overview

Self-hosted on a single server behind Caddy. Everything except Caddy runs in Docker Compose.
GitLab CI builds images and pushes to DockerHub. Deploys are manual for now (run on the server directly).

---

## Status

| File                         | Status  | Notes                                                                |
| ---------------------------- | ------- | -------------------------------------------------------------------- |
| `packages/app/Dockerfile`    | ✅ Done | Multi-stage: vite build → nginx                                      |
| `packages/app/nginx.conf`    | ✅ Done | SPA fallback for Vue Router                                          |
| `packages/server/Dockerfile` | ✅ Done | pnpm deploy --prod, runs via `node src/index.ts` (Node 24 native TS) |
| `.dockerignore`              | ✅ Done | Excludes node_modules, .env, dist                                    |
| `docker-compose.yml`         | ✅ Done | frontend, server, postgres, redis                                    |
| `.gitlab-ci.yml`             | ✅ Done | Builds + pushes both images to DockerHub on `main`                   |
| `.env.example`               | ⬜ Todo | Document required env vars                                           |
| Caddyfile config             | ⬜ Todo | Snippet to add to server's Caddyfile                                 |
| One-time server setup        | ⬜ Todo | Steps to run on the server the first time                            |

---

## Dockerfiles

### `packages/app/Dockerfile`

Two stages:

1. `builder` — Node 24 alpine, installs workspace deps, runs `vite build` (type checking is skipped — run separately in CI if desired)
2. `runner` — nginx:alpine, copies `dist/`, serves on port 80 with SPA fallback

### `packages/server/Dockerfile`

Two stages:

1. `installer` — installs full workspace deps, runs `pnpm deploy --prod --legacy` to produce a self-contained production dir
2. `runner` — Node 24 alpine, copies deployed dir, runs `node src/index.ts`

Node 24 strips TypeScript natively — no tsx or compile step needed.

---

## Docker Compose

Four services. Frontend and server bind only to `127.0.0.1` so Caddy (on the host) can reach them but they are not exposed to the internet directly.

```
frontend  → 127.0.0.1:3000
server    → 127.0.0.1:8070
postgres  → 127.0.0.1:5432 (internal + accessible locally for migrations/admin)
redis     → internal only
```

Postgres credentials and server env vars come from a `.env` file on the server (not committed).

---

## Caddyfile (add to server)

```
vrt.lachlan-miller.me {
    handle /api/* {
        reverse_proxy localhost:8070
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

Note: Caddy does not strip the `/api` prefix by default. The Fastify server will receive requests
at `/api/...` — verify your routes include the prefix or strip it in Caddy with `uri strip_prefix /api`.

---

## GitLab CI

Single `build` stage, runs on `main` only. Uses Docker-in-Docker.

Builds and pushes both images tagged with `$CI_COMMIT_SHA` and `latest`.

### CI variables to add in GitLab → Settings → CI/CD → Variables

| Variable             | Value                  | Options |
| -------------------- | ---------------------- | ------- |
| `DOCKERHUB_USERNAME` | `lachlanmillerdev`     |         |
| `DOCKERHUB_TOKEN`    | DockerHub access token | Masked  |

Generate the DockerHub token at: Account Settings → Personal access tokens → Read & Write scope.

---

## Manual deploy (on the server)

```bash
docker compose pull
docker compose run --rm server pnpm db:migrate   # run migrations first
docker compose up -d
```

---

## One-time server setup

1. Install Docker + Compose plugin
2. Copy `docker-compose.yml` to the server (or clone repo)
3. Create `.env` alongside `docker-compose.yml` with production values (see env vars below)
4. Add Caddyfile block above and `caddy reload`
5. `docker compose up -d`

---

## Environment variables (`.env` on server)

```
DATABASE_URL=postgresql://imgcompare:yourpassword@postgres:5432/imgcompare
POSTGRES_PASSWORD=yourpassword
POSTGRES_USER=imgcompare
POSTGRES_DB=imgcompare
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET=
JWT_SECRET=
```

---

## Open questions

- [ ] Confirm `pnpm db:migrate` (`drizzle-kit push`) is safe for production — consider switching to `drizzle-kit migrate` which runs versioned SQL files instead of pushing schema diffs
- [ ] Postgres backup strategy (pg_dump cron job or managed backup)
