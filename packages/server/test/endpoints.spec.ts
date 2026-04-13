import { describe, beforeAll, it, afterAll, expect } from "vitest";
import { Client, Pool } from "pg";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema.ts";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { fastify } from "../src/index.ts";

describe("Postgres container (ESM)", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await client.end();
    await container.stop();
    await fastify.close();
  });

  it("should connect to postgres", async () => {
    await db
      .insert(schema.users)
      .values({ email: "lachlan@miller.me", password: "123" });
    const res = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "lachlan@miller.me"));
    expect(res).toContainEqual(
      expect.objectContaining({
        email: "lachlan@miller.me",
        password: "123",
      }),
    );
  });

  it("401 when unauthenticated", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "projects",
    });

    expect(response.statusCode).toBe(401);
  });
});
