import { describe, beforeAll, it, afterAll, expect } from 'vitest'
import { Client } from "pg";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';


describe("Postgres container (ESM)", () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();

    client = new Client({
      connectionString: container.getConnectionUri(),
    });

    await client.connect();

    const db = drizzle(client)
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  it("should connect to postgres", async () => {
    const res = await client.query("SELECT 1");
    expect(res.rows[0]).toEqual({ "?column?": 1 });
  });
});