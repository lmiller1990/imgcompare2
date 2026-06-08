#!/usr/bin/env bash
set -euo pipefail

# Single application image: Fastify serves the API and the built Vue frontend,
# and the same image runs migrations (`node src/migrate.ts`).
docker buildx build --load --platform linux/amd64 -t lachlanmillerdev/imgcompare-server -f ./packages/server/Dockerfile .

docker push lachlanmillerdev/imgcompare-server
