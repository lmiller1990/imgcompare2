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

describe("client credentials", () => {
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
      url: `/api/projects/${projectId}/credentials`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates credentials and returns client_id + client_secret", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.clientId).toBeTruthy();
    expect(body.clientSecret).toBeTruthy();
  });

  it("409 when active credential already exists", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/already exists/);
  });

  it("GET returns client_id only (no secret)", async () => {
    const res = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.clientId).toBeTruthy();
    expect(body.clientSecret).toBeUndefined();
  });

  it("POST /auth/token returns JWT for valid credentials", async () => {
    const getRes = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    const { clientId } = getRes.json<{ clientId: string }>();

    // revoke and re-create so we have the plaintext secret
    await fastify.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    const createRes = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    const { clientId: newClientId, clientSecret } =
      createRes.json<{ clientId: string; clientSecret: string }>();

    const tokenRes = await fastify.inject({
      method: "POST",
      url: "/api/auth/token",
      payload: { clientId: newClientId, clientSecret },
    });

    expect(tokenRes.statusCode).toBe(200);
    const { token } = tokenRes.json<{ token: string }>();
    expect(token).toBeTruthy();
    const decoded = fastify.jwt.decode<{ projectId: string; type: string }>(
      token,
    );
    expect(decoded!.projectId).toBe(projectId);
    expect(decoded!.type).toBe("service");
  });

  it("401 for wrong client_secret", async () => {
    const getRes = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    const { clientId } = getRes.json<{ clientId: string }>();

    const res = await fastify.inject({
      method: "POST",
      url: "/api/auth/token",
      payload: { clientId, clientSecret: "wrong-secret" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("DELETE revokes the credential", async () => {
    const res = await fastify.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("GET 404 after revocation", async () => {
    const res = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE 404 when no active credential", async () => {
    const res = await fastify.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("can create new credential after revocation", async () => {
    const res = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.clientId).toBeTruthy();
    expect(body.clientSecret).toBeTruthy();
  });

  it("401 on token exchange after revocation", async () => {
    const createRes = await fastify.inject({
      method: "POST",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });

    // This should 409 (already active from previous test), so get current clientId
    const getRes = await fastify.inject({
      method: "GET",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    const { clientId } = getRes.json<{ clientId: string }>();

    // Revoke it
    await fastify.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/credentials`,
      headers: { authorization: `Bearer ${jwt}` },
    });

    // Token exchange with revoked clientId should fail
    const tokenRes = await fastify.inject({
      method: "POST",
      url: "/api/auth/token",
      payload: { clientId, clientSecret: "any-secret" },
    });

    expect(tokenRes.statusCode).toBe(401);
  });
});
