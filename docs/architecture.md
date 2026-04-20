## Architecture

### Current: Self-Hosted (Single Box)

```mermaid
graph TB
    User([Browser])
    DNS[Namecheap DNS]
    S3[(AWS S3\nAssets)]

    subgraph Server ["Server (single box)"]
        Caddy[Caddy\nHTTPS / reverse proxy\nport 80, 443]

        subgraph Compose ["Docker Compose"]
            FE[frontend\nnginx serving Vue SPA\nport 3000]
            BE[server\nFastify API\nport 8070]
            DB[(postgres\nport 5432)]
            RD[(redis\nport 6379)]
        end
    end

    User -->|HTTPS| DNS
    DNS -->|A record| Caddy
    Caddy -->|app.example.com| FE
    Caddy -->|api.example.com| BE
    BE --> DB
    BE --> RD
    BE --> S3
```

### Future: AWS

```mermaid
graph TB
    User([Browser])
    CF[CloudFront CDN]
    ALB[ALB\nHTTPS termination]
    S3[(S3\nStatic assets +\nfrontend)]

    subgraph ECS ["ECS Fargate"]
        BE[server\nFastify API]
    end

    RDS[(RDS\nPostgres)]
    EC[(ElastiCache\nRedis)]

    User --> CF
    CF -->|API requests| ALB
    CF -->|Static files| S3
    ALB --> BE
    BE --> RDS
    BE --> EC
    BE --> S3
```

### What changes between environments

| Concern | Self-hosted | AWS |
|---|---|---|
| HTTPS / ingress | Caddy (host) | ALB + ACM cert |
| Frontend serving | nginx container | S3 + CloudFront |
| API container | Docker Compose | ECS Fargate |
| Postgres | Docker Compose | RDS |
| Redis | Docker Compose | ElastiCache |
| Assets | S3 | S3 (same) |
| Secrets | `.env` on server | Secrets Manager / SSM |

The app containers themselves don't change — only the surrounding infrastructure.
Config stays in environment variables (12-factor) so containers are portable.
```
