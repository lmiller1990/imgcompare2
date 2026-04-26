import { clientCredentials } from "../db/schema.ts";
import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import type { DB } from "../db/index.ts";

const SALT_ROUNDS = 12;

export class CredentialService {
  #db: DB;

  constructor(db: DB) {
    this.#db = db;
  }

  async getActive(projectId: string) {
    return this.#db
      .select()
      .from(clientCredentials)
      .where(
        and(
          eq(clientCredentials.projectId, projectId),
          isNull(clientCredentials.revokedAt),
        ),
      )
      .then((r) => r[0] ?? undefined);
  }

  async create(projectId: string) {
    const clientId = randomBytes(16).toString("hex");
    const clientSecret = randomBytes(32).toString("hex");
    const clientSecretHash = await bcrypt.hash(clientSecret, SALT_ROUNDS);

    const rows = await this.#db
      .insert(clientCredentials)
      .values({ projectId, clientId, clientSecretHash })
      .returning();

    return { ...rows[0]!, clientSecret };
  }

  async revoke(projectId: string) {
    const credential = await this.getActive(projectId);
    if (!credential) {
      return undefined;
    }

    await this.#db
      .update(clientCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(clientCredentials.id, credential.id));

    return credential;
  }

  async verifySecret(clientId: string, clientSecret: string) {
    const rows = await this.#db
      .select()
      .from(clientCredentials)
      .where(eq(clientCredentials.clientId, clientId));

    const credential = rows[0];
    if (!credential || credential.revokedAt) {
      return undefined;
    }

    const ok = await bcrypt.compare(clientSecret, credential.clientSecretHash);
    return ok ? credential : undefined;
  }
}
