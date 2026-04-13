import { describe, beforeAll, it, afterAll, expect } from "vitest";
import { Client } from "pg";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema.ts";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.ts";

describe("Postgres container (ESM)", () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let fastify: Awaited<ReturnType<typeof createApp>>["fastify"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    const { fastify: app } = await createApp({ db });
    fastify = app;
    await app.ready();
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

  it("allows accessing owned project", async () => {
    const u1 = await db
      .insert(schema.users)
      .values({ email: "a@b.com", password: "abc" })
      .returning();
    const u2 = await db
      .insert(schema.users)
      .values({ email: "c@d.com", password: "abc" })
      .returning();

    const p1 = await db
      .insert(schema.projects)
      .values({
        ownerUserId: u1[0]!.id,
        name: "a@b.com's project",
      })
      .returning();

    const p2 = await db
      .insert(schema.projects)
      .values({
        ownerUserId: u2[0]!.id,
        name: "c@d.com's project",
      })
      .returning();

    const jwt = fastify.jwt.sign({ email: "a@b.com" });

    let response = await fastify.inject({
      method: "POST",
      url: `projects/${p1[0]!.id}/runs`,
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    });

    expect(response.statusCode).toBe(201);

    response = await fastify.inject({
      method: "POST",
      url: `projects/${p2[0]!.id}/runs`,
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
