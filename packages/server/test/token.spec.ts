import { describe, beforeAll, it, afterAll, expect } from "vitest";
import { Client } from "pg";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema.ts";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { createApp } from "../src/app.ts";

describe("ci tokens", () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let fastify: Awaited<ReturnType<typeof createApp>>["fastify"];
  let projectId: string;
  let jwt: string;

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

    const [user] = await db
      .insert(schema.users)
      .values({ email: "owner@test.com", password: "hashed" })
      .returning();

    const [project] = await db
      .insert(schema.projects)
      .values({ ownerUserId: user!.id, name: "test project" })
      .returning();

    projectId = project!.id;
    jwt = fastify.jwt.sign({ email: "owner@test.com" });
  });

  afterAll(async () => {
    await client.end();
    await container.stop();
    await fastify.close();
  });

  it("401 when unauthenticated", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/token`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("saves a token and returns 204", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/token`,
      headers: { authorization: `Bearer ${jwt}` },
      payload: { provider: "gitlab", token: "glpat-abcdef1234567890abcd" },
    });
    expect(res.statusCode).toBe(204);
  });

  it("GET returns hint and provider, not the raw token", async () => {
    const res = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/token/gitlab`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ hint: string; provider: string }>();
    expect(body.provider).toBe("gitlab");
    expect(body.hint).toBe("glpat-...abcd");
    expect(body.hint).not.toContain("1234567890");
  });

  it("overwrites token on second save (upsert)", async () => {
    const save = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/token`,
      headers: { authorization: `Bearer ${jwt}` },
      payload: { provider: "gitlab", token: "glpat-zzzzzzzzzzzzzzzzzzzz" },
    });
    expect(save.statusCode).toBe(204);

    const check = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/token/gitlab`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(check.json<{ hint: string }>().hint).toBe("glpat-...zzzz");
  });

  it("DELETE revokes the token", async () => {
    const res = await fastify.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/token/gitlab`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("GET 404 after revocation", async () => {
    const res = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/token/gitlab`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE 404 when no token exists", async () => {
    const res = await fastify.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/token/gitlab`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("can save again after revocation", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/token`,
      headers: { authorization: `Bearer ${jwt}` },
      payload: { provider: "gitlab", token: "glpat-newtoken1234567890ab" },
    });
    expect(res.statusCode).toBe(204);
  });
});
