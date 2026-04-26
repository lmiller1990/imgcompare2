# Server

## Database

Update schema in `src/db/schema.ts`. Run `pnpm db:generate` to general the SQL, and pnpm db:migrate` to run them against a database.

Access the database:

```
docker exec -it imgcompare-postgres psql -U imgcompare -d imgcompare
```

## Notes

We run with `--strip-types`. So we cannot use propietary TypeScript features like:

```ts
class Foo {
  // NO - `private readonly` for autoamtic property assignment does not work
  constructor(private readonly bar: string) {}
}
```

Instead:

```ts
class Foo {
  #bar: string;
  constructor(bar: string) {
    this.#bar = bar;
  }
}
```

## Setup & Development

Copy `.env.example` to `.env` and fill in the values:

```sh
cp .env.example .env
```

Generate a master key for token encryption:

```sh
openssl rand -base64 32
```

Paste the output as the `MASTER_KEY` value in `.env`.

## CI Token Encryption

CI runner tokens (e.g. GitLab project tokens) are stored encrypted at rest using **envelope encryption** with AES-256-GCM.

### How it works

Each token is encrypted with a freshly generated 32-byte **data key**. That data key is itself encrypted with the **master key** (`MASTER_KEY` env var). Both encrypted blobs are packed into a single `bytea` column (`ci_token_ciphertext`) on the `projects` table.

```
Blob layout:
  [4B big-endian: length of encrypted data key]
  [encrypted data key  — IV + auth tag + ciphertext]
  [encrypted token     — IV + auth tag + ciphertext]
```

The project UUID is used as **Additional Authenticated Data (AAD)** when encrypting the token. This cryptographically binds the ciphertext to that specific project row — the token cannot be decrypted if moved to a different project.

### Key management

| Concern            | Approach                                                                              |
| ------------------ | ------------------------------------------------------------------------------------- |
| Master key storage | `.env` file locally; use a secrets manager (AWS Secrets Manager, Vault) in production |
| Key rotation       | Re-encrypt `ci_token_ciphertext` rows with new data keys under the new master key     |
| Algorithm          | AES-256-GCM (authenticated encryption — detects tampering)                            |

### API

**Store a token**

```
POST /projects/:id/token
Authorization: Bearer <jwt>
Content-Type: application/json

{ "token": "glpat-xxxxxxxxxxxx" }
```

Returns `204 No Content`.

**Retrieve a token**

```
GET /projects/:id/token
Authorization: Bearer <jwt>
```

Returns `{ "token": "glpat-xxxxxxxxxxxx" }`.

## Client Credentials (CI Authentication)

Projects support machine authentication via client credentials. A project owner generates a client ID and secret through the API — the secret is shown once and must be stored securely (e.g. in CI secrets). CI runners exchange the client ID and secret for a short-lived JWT, which is then used to authenticate API requests.
