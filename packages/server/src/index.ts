import "dotenv/config";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { getDb } from "./db/index.ts";
import { createApp } from "./app.ts";

export const logger = pino({ level: "debug" });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = getDb();
  const { fastify } = await createApp({ db });

  try {
    await fastify.listen({ port: 8070 });
    console.info("=== Routes ===\n\n", fastify.printRoutes());
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
