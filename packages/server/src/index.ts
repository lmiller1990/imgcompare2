import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import fastifyJwt from '@fastify/jwt'
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcrypt'
import { users } from './db/schema.ts';
import { eq } from 'drizzle-orm';


const salt = 12
const db = drizzle(process.env.DATABASE_URL!);

const fastify = Fastify({ logger: { level: "debug" } })
  .register(multipart)
  .register(fastifyJwt, { secret: "secret123" })

fastify.get('/health', async () => {
  return { status: 'ok' }
})

fastify.post<{ Body: { email: string, password: string } }>("/signup", async (req, reply) => {
  const token = fastify.jwt.sign({ email: req.body.email })
  const hash = await bcrypt.hash(req.body.password, salt)
  await db.insert(users).values({ email: req.body.email, password: hash })
  reply.send({ token })
})

fastify.post<{ Body: { email: string, password: string } }>("/login", async (req, reply) => {
  const q = await db.select().from(users).where(eq(users.email, req.body.email))
  const user = q?.[0]
  if (!user) {
    return reply.code(401).send({
      error: "Invalid credentials"
    })
  }

  const ok = await bcrypt.compare(req.body.password, user.password)
  if (!ok) {
    return reply.code(401).send({
      error: "Invalid credentials"
    })
  }

  const token = fastify.jwt.sign({ email: req.body.email })
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
