# Server

## Setup

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
