#!/bin/bash
set -euo pipefail

# Install Docker
dnf update -y
dnf install -y docker
systemctl enable --now docker

# Install Docker Compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p /opt/imgcompare

cat > /opt/imgcompare/.env <<'ENVFILE'
MASTER_KEY=${master_key}
ENVFILE

cat > /opt/imgcompare/docker-compose.yml <<'COMPOSEFILE'
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: imgcompare
      POSTGRES_USER: imgcompare
      POSTGRES_PASSWORD: imgcompare
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U imgcompare"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  server:
    image: lachlanmillerdev/imgcompare-server
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://imgcompare:imgcompare@postgres:5432/imgcompare
      REDIS_HOST: redis
      MASTER_KEY: ${master_key}
      AWS_REGION: ap-southeast-2
      S3_BUCKET: mls-imgcompare

  frontend:
    image: lachlanmillerdev/imgcompare-frontend
    restart: unless-stopped

  nginx:
    image: lachlanmillerdev/imgcompare-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - frontend
      - server

volumes:
  postgres_data:
  redis_data:
COMPOSEFILE

cd /opt/imgcompare
docker compose pull
docker compose up -d
