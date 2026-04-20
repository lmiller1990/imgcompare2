# Deployment Plan

## Overview

Self-hosted on a single server behind Caddy. Everything except Caddy runs in Docker Compose.
GitLab CI builds images, pushes to DockerHub, then deploys via SSH.

---

## Files to create

| File | Purpose |
|---|---|
| `packages/app/Dockerfile` | Multi-stage: build Vue with Node, serve with nginx |
| `packages/server/Dockerfile` | Install deps, run with tsx (no TS compile step) |
| `docker-compose.yml` | frontend, server, postgres, redis |
| `.env.example` | Documents required environment variables |
| `.gitlab-ci.yml` | Build → push → deploy pipeline |
| `scripts/deploy.sh` | Runs on the server via SSH: pull, migrate, restart |

---

## Dockerfiles

### `packages/app/Dockerfile`

Two stages:
1. `build` — Node 22, installs deps, runs `pnpm build`, outputs `dist/`
2. `serve` — nginx:alpine, copies `dist/` in, serves on port 80

The nginx config needs to handle client-side routing (Vue Router): all 404s should
fall back to `index.html`.

### `packages/server/Dockerfile`

Single stage:
- Node 22 alpine
- Install pnpm, copy workspace files, install production deps
- Run via `tsx src/index.ts` (avoids needing a separate TS build step since tsconfig has `noEmit: true`)
- Exposes port 8070

The pnpm workspace means we need to copy root `package.json` + `pnpm-workspace.yaml`
alongside `packages/server/` so the install works correctly.

---

## Docker Compose (`docker-compose.yml`)

Four services, one network (`imgcompare`):

- **frontend** — `lachlanmillerdev/imgcompare-frontend:latest`, port 80 (internal only)
- **server** — `lachlanmillerdev/imgcompare-server:latest`, port 8070 (internal only)
- **postgres** — `postgres:17-alpine`, data volume, internal only
- **redis** — `redis:7-alpine`, internal only

Caddy on the host references containers by name:
```
reverse_proxy imgcompare-frontend:80
reverse_proxy imgcompare-server:8070
```

For this to work, Caddy must be able to reach the Docker network. Options:
- Use `network_mode: host` on the containers (simple, Linux only)
- Or add Caddy to the Docker network via `docker network connect`
- Or expose ports to localhost only (`127.0.0.1:3000:80`) and have Caddy proxy to localhost

Recommended: expose to localhost only — most explicit, avoids network bridging complexity:
```yaml
ports:
  - "127.0.0.1:3000:80"   # frontend
  - "127.0.0.1:8070:8070" # server
```

Then Caddyfile:
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

---

## Environment variables

The server needs:
- `DATABASE_URL` — postgres connection string
- `REDIS_URL` — redis connection string  
- `AWS_ACCESS_KEY_ID` — S3 / CloudWatch
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET`
- `JWT_SECRET`

These live in a `.env` file on the server (not committed). Docker Compose loads it via `env_file: .env`.

---

## GitLab CI (`.gitlab-ci.yml`)

Three stages: `build`, `push`, `deploy`

### build

- Runs on GitLab's Docker-in-Docker runner
- Builds both images: `imgcompare-frontend` and `imgcompare-server`
- Tags with `$CI_COMMIT_SHA` and `latest`

### push

- Logs into DockerHub using CI variables `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`
- Pushes both images

### deploy

- Only runs on `main` branch
- SSHs into the server using `SSH_PRIVATE_KEY` CI variable
- Runs `scripts/deploy.sh` remotely

### GitLab CI variables to configure

| Variable | Where to set |
|---|---|
| `DOCKERHUB_USERNAME` | GitLab CI/CD settings |
| `DOCKERHUB_TOKEN` | GitLab CI/CD settings (masked) |
| `SSH_PRIVATE_KEY` | GitLab CI/CD settings (masked) |
| `DEPLOY_HOST` | GitLab CI/CD settings (your server IP/hostname) |
| `DEPLOY_USER` | GitLab CI/CD settings |

---

## Deploy script (`scripts/deploy.sh`)

Runs on the server after SSH. Steps:
1. `docker compose pull` — pull new images
2. `docker compose run --rm server pnpm db:migrate` — run migrations before restart
3. `docker compose up -d` — restart with new images

Migrations run against the live database before the new server starts,
so the schema is always ahead of the running code (safe for additive migrations).

---

## One-time server setup

1. Install Docker + Docker Compose plugin
2. Clone repo (or just copy `docker-compose.yml` + `.env`)
3. Create `.env` with production values
4. Add the GitLab deploy SSH public key to `~/.ssh/authorized_keys`
5. Configure Caddyfile and reload Caddy
6. Run `docker compose up -d` once manually to initialise

---

## Open questions / decisions

- [ ] Confirm server OS and whether Docker is already installed
- [ ] Decide on postgres data backup strategy (pg_dump cron, or managed)
- [ ] Confirm `pnpm db:migrate` uses `drizzle-kit migrate` (safe) not `drizzle-kit push` (destructive in prod)
