import "dotenv/config";
import { createApp } from "./app.ts";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { getDb } from "./db/index.ts";

export const logger = pino({ level: "debug" });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = getDb();
  if (!db) {
    throw new Error(`DB should not be undefined when running as a module.`);
  }
  const { fastify } = await createApp({ db });

  try {
    await fastify.listen({ port: 8070 });
    console.info("=== Routes ===\n\n", fastify.printRoutes());
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
