import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Apply the committed SQL migrations in ./drizzle. This uses the runtime
// migrator shipped with drizzle-orm (a production dependency), so it runs
// inside the server image with no drizzle-kit and no host Node required.
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);

const db = drizzle(process.env.DATABASE_URL!);

console.info(`Running migrations from ${migrationsFolder}`);
await migrate(db, { migrationsFolder });
console.info("Migrations complete");

await db.$client.end();
