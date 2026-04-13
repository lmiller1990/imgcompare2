import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { createApp } from "./app.ts";
import * as schema from "../src/db/schema.ts";
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = drizzle(process.env.DATABASE_URL!, { schema });
  const { fastify } = await createApp({ db });

  try {
    await fastify.listen({ port: 8070 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
