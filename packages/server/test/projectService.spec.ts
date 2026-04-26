import { describe, beforeAll, it, afterAll, expect } from "vitest";
import { Client } from "pg";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema.ts";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { ProjectService } from "../src/services/projectService.ts";
import type { DB } from "../src/db/index.ts";

describe("ProjectService", () => {
  let container: StartedPostgreSqlContainer;
  let client: Client;
  let db: NodePgDatabase<typeof schema>;
  let projectService: ProjectService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    client = new Client({ connectionString: container.getConnectionUri() });
    await client.connect();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    projectService = new ProjectService(db as DB);
  });

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  it("returns undefined when user does not exist", async () => {
    const result = await projectService.createProject(
      "my project",
      "unknown@example.com",
    );
    expect(result).toBeUndefined();
  });

  it("inserts and returns the project for a valid user", async () => {
    await db
      .insert(schema.users)
      .values({ email: "test@example.com", password: "secret" });

    const result = await projectService.createProject(
      "my project",
      "test@example.com",
    );

    expect(result).toMatchObject({ name: "my project" });
  });
});
