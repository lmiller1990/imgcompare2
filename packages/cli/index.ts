// export
import { spawn } from "node:child_process"
import pino from 'pino'

const logger = pino({
  level: "debug",
  transport: {
    target: 'pino-pretty',
  },
})

export async function run(process: NodeJS.Process) {
  let cleanArgs = process.argv.slice(2)
  cleanArgs = cleanArgs[0] === "--" ? cleanArgs.slice(1) : cleanArgs;
  const log = logger.child({ args: cleanArgs })

  log.debug("Running with args")
  const [cmd, ...args] = cleanArgs
  if (!cmd) {
    throw new Error(`You need to pass a command, eg pnpm exec <tool> playwright test`)
  }

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: false
  })


  child.on("exit", (code, signal) => {
    console.log(`Finished with ${code} and signal: ${signal}`)
    // forward this to ensure we fail with same status as uses process
    process.exit(code)
  })
}

run(process)