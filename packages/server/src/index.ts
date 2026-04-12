import Fastify from 'fastify'
import fs from 'node:fs'
import multipart from '@fastify/multipart'
import { pipeline } from 'node:stream/promises'

const fastify = Fastify({ logger: { level: "debug" } })
  .register(multipart)

fastify.get('/health', async () => {
  return { status: 'ok' }
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
