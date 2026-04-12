import { spawn } from "node:child_process"
import pino from 'pino'
import { globby } from 'globby'
import { input, password as passwordPrompt } from '@inquirer/prompts';
import fs from 'fs'
import path, { dirname } from "node:path"
import ky from 'ky'
import os from 'os';

const TOKEN_PATH = path.join(os.homedir(), '.imgtoken');

async function getStoredToken() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  try {
    const data = JSON.parse(await fs.promises.readFile(TOKEN_PATH, 'utf-8'));
    return data.token;
  } catch {
    //
  }
}

async function saveToken(token: string) {
  fs.promises.writeFile(TOKEN_PATH, JSON.stringify({ token }), {
    mode: 0o600,
  });
}

async function signup() {
  const { email, password } = await promptCredentials()
  try {
    const res = await ky.post<{ token: string }>("http://localhost:8070/signup", {
      json: {
        email, password
      },
    })
    await saveToken((await res.json()).token)
    console.log("Welcome aboard!")
  } catch (error) {
    console.error(`Error occurred: ${error}`)
    logger.child({ error }).error("Error posting to server")
    //
  }
}

async function login() {
  const { email, password } = await promptCredentials()
  try {
    const res = await ky.post<{ token: string }>("http://localhost:8070/login", {
      json: {
        email, password
      },
    })
    await saveToken((await res.json()).token)
    console.log("Logged in.")
  } catch (error) {
    console.error("Invalid email or password.")
    logger.child({ error }).error("Error posting to server")
    //
  }
}

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
    const buffer = await fs.promises.readFile(path)
    form.append("screenshots", new Blob([buffer]), path)
  }

  try {
    const res = await ky.post("http://localhost:8070/projects/:id/run", {
      body: form,
    })
  } catch (error) {
    logger.child({ error }).error("Error posting to server")
    //
  }
}

export async function promptCredentials() {
  const email = await input(
    {
      message: 'Enter your email',
      required: true,
    },
  );

  const password = await passwordPrompt(
    {
      message: 'Enter a password',
    },
  );

  return { email, password }
}

async function createNewProject() {

}

async function loadConfig() {
  const p = dirname(process.cwd())
  const configPath = path.join(p, "config.json")

  try {
    const data = await fs.promises.readFile(configPath, "utf-8")
    return JSON.parse(JSON.parse(data))
  } catch (err) {
    const e = err as NodeJS.ErrnoException

    if (e.code === "ENOENT") {
      const projectId = await createNewProject()

      const defaultConfig = { projectId }
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8"
      )

      console.log(`
No config.json found.
A new one has been created at:
  ${configPath}

Please review and update it as needed.
`)

      return defaultConfig
    }

    // Other errors should not be silently swallowed
    throw e
  }
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

  if (cmd === "login") {
    await login()
    return
  }

  if (cmd === "signup") {
    await signup()
    return
  }

  const config = await loadConfig()

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: false
  })

  child.on("exit", async (code, signal) => {
    console.log(`Finished with ${code} and signal: ${signal}`)

    const files = await findAllScreenshots(process.cwd())
    await postScreenshots(files)

    // forward this to ensure we fail with same status as uses process
    process.exit(code)
  })
}

run(process)