import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import fastifyJwt from '@fastify/jwt'
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from './db/schema.ts';


const db = drizzle(process.env.DATABASE_URL!);

const fastify = Fastify({ logger: { level: "debug" } })
  .register(multipart)
  .register(fastifyJwt, { secret: "secret123" })

fastify.get('/health', async () => {
  return { status: 'ok' }
})

fastify.post<{ Body: { email: string, password: string } }>("/signup", async (req, reply) => {
  const token = fastify.jwt.sign({ email: req.body.email })
  db.insert(users).values({ email: req.body.email, password: req.body.password })
  reply.send({ token })
})

fastify.post("/projects/:id/run", async (req, reply) => {
  for await (const file of req.files()) {
    if (file.fieldname === "screenshots") {
      req.log.debug(`Received screenshot ${file.filename}`)
    }
    // console.log("OKKKKKKKKKKKKK")
    // req.log.child({ data: typeof data, filename: data.filename }).debug("Got file data")
    // await pipeline(data.file, fs.createWriteStream(data.filename))
    // data.file // stream
    // data.fields // other parsed parts
    // data.fieldname
    // data.filename
    // data.encoding
    // data.mimetype
  }


  reply.send()
})

try {
  await fastify.listen({ port: 8070 })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
