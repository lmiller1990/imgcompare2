import { spawn } from "node:child_process"
import pino from 'pino'
import { globby } from 'globby'
import fs from 'fs'
import path from "node:path"
import ky from 'ky'

const logger = pino({
  level: "debug",
  transport: {
    target: 'pino-pretty',
  },
})

async function findAllScreenshots(cwd: string) {
  const files = await globby(path.posix.join(cwd, "**/*.png"))
  logger.child({ files }).debug("Found files")
  return files
}

async function postScreenshots(files: string[]) {
  const form = new FormData()

  for (const path of files) {
    form.append("screenshots", fs.createReadStream(path))
  }

  const res = await ky.post("http://localhost:8070", {
    body: form
  })
}

export async function run(process: NodeJS.Process) {
  let cleanArgs = process.argv.slice(2)
  cleanArgs = cleanArgs[0] === "--" ? cleanArgs.slice(1) : cleanArgs;
  const log = logger.child({ args: cleanArgs, cwd: process.cwd() })

  log.debug("Running")
  const [cmd, ...args] = cleanArgs
  if (!cmd) {
    throw new Error(`You need to pass a command, eg pnpm exec <tool> playwright test`)
  }

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: false
  })

  child.on("exit", async (code, signal) => {
    console.log(`Finished with ${code} and signal: ${signal}`)

    const files = await findAllScreenshots(process.cwd())
    ky.post

    // forward this to ensure we fail with same status as uses process
    process.exit(code)
  })
}

run(process)