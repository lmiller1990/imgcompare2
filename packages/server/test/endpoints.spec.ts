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
    process.env["MASTER_KEY"] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
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
      url: "/api/projects",
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
      url: `/api/projects/${p1[0]!.id}/runs`,
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    });

    expect(response.statusCode).toBe(201);

    response = await fastify.inject({
      method: "POST",
      url: `/api/projects/${p2[0]!.id}/runs`,
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("service token can access its own project", async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: "ci@example.com", password: "hashed" })
      .returning();

    const [project] = await db
      .insert(schema.projects)
      .values({ ownerUserId: user!.id, name: "ci project" })
      .returning();

    const ownerJwt = fastify.jwt.sign({ email: "ci@example.com" });

    const createRes = await fastify.inject({
      method: "POST",
      url: `/api/projects/${project!.id}/credentials`,
      headers: { authorization: `Bearer ${ownerJwt}` },
    });
    const { clientId, clientSecret } = createRes.json<{
      clientId: string;
      clientSecret: string;
    }>();

    const tokenRes = await fastify.inject({
      method: "POST",
      url: "/api/auth/token",
      payload: { clientId, clientSecret },
    });
    const { token: serviceToken } = tokenRes.json<{ token: string }>();

    const response = await fastify.inject({
      method: "POST",
      url: `/api/projects/${project!.id}/runs`,
      headers: { authorization: `Bearer ${serviceToken}` },
    });

    expect(response.statusCode).toBe(201);
  });

  it("service token cannot access a different project", async () => {
    const [userA] = await db
      .insert(schema.users)
      .values({ email: "ci-a@example.com", password: "hashed" })
      .returning();
    const [userB] = await db
      .insert(schema.users)
      .values({ email: "ci-b@example.com", password: "hashed" })
      .returning();

    const [projectA] = await db
      .insert(schema.projects)
      .values({ ownerUserId: userA!.id, name: "project a" })
      .returning();
    const [projectB] = await db
      .insert(schema.projects)
      .values({ ownerUserId: userB!.id, name: "project b" })
      .returning();

    const ownerJwt = fastify.jwt.sign({ email: "ci-a@example.com" });

    const createRes = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectA!.id}/credentials`,
      headers: { authorization: `Bearer ${ownerJwt}` },
    });
    const { clientId, clientSecret } = createRes.json<{
      clientId: string;
      clientSecret: string;
    }>();

    const tokenRes = await fastify.inject({
      method: "POST",
      url: "/api/auth/token",
      payload: { clientId, clientSecret },
    });
    const { token: serviceToken } = tokenRes.json<{ token: string }>();

    const response = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectB!.id}/runs`,
      headers: { authorization: `Bearer ${serviceToken}` },
    });

    expect(response.statusCode).toBe(401);
  });
});
