## Development

```
pnpm -r --parallel run dev
```

## Architecture

```mermaid
graph TB
    User([Browser])
    DNS[Namecheap DNS\nvrt.lachlan-miller.me]
    S3[(AWS S3\nAssets)]

    subgraph Server ["Server (single box)"]
        Caddy["Caddy (host)\nHTTPS + reverse proxy\n:80 / :443"]

        subgraph Compose ["Docker Compose"]
            FE[frontend\nnginx\nimgcompare-frontend:80]
            BE[server\nFastify + tsx\nimgcompare-server:8070]
            DB[(postgres\n:5432)]
            RD[(redis\n:6379)]
        end
    end

    User -->|HTTPS| DNS
    DNS --> Caddy
    Caddy -->|/| FE
    Caddy -->|/api/*| BE
    BE --> DB
    BE --> RD
    BE --> S3
```

### AWS migration path

When moving to AWS, only the surrounding infrastructure changes — not the containers:

| Concern         | Self-hosted       | AWS                   |
|-----------------|-------------------|-----------------------|
| HTTPS / ingress | Caddy (host)      | ALB + ACM             |
| Frontend        | nginx container   | S3 + CloudFront       |
| API             | Fastify container | ECS Fargate           |
| Postgres        | Docker Compose    | RDS                   |
| Redis           | Docker Compose    | ElastiCache           |
| Assets          | S3                | S3 (unchanged)        |
| Secrets         | `.env` on server  | Secrets Manager / SSM |
