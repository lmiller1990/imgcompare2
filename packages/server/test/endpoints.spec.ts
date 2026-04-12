import { describe, beforeAll, it, afterAll, expect } from 'vitest'
import { Client, Pool } from "pg";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema.ts";
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';


describe("Postgres container (ESM)", () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let pool: Pool;
  let db: ReturnType<typeof drizzle>

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();

    client = new Client({
      connectionString: container.getConnectionUri(),
    });

    pool = new Pool({
      connectionString: container.getConnectionUri(),
    });

    await pool.connect();

    db = drizzle(pool)
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  it("should connect to postgres", async () => {
    await db.insert(schema.users).values({ name: "Lachlan", email: "lachlan@miller.me", password: "123" })
    const res = await db.select().from(schema.users).where(eq(schema.users.email, "lachlan@miller.me"))
    console.log("res>>>>>>>>>>>", res)
  });
});