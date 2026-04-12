import { spawn } from "node:child_process"
import pino from 'pino'
import { globby } from 'globby'
import { input, password as passwordPrompt } from '@inquirer/prompts';
import fs from 'fs'
import path, { dirname } from "node:path"
import ky from 'ky'
import os from 'os';

const TOKEN_PATH = path.join(os.homedir(), '.imgtoken');

const api = ky.extend({
  baseUrl: 'http://localhost:8070',
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        const token = await getStoredToken();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      }
    ]
  }
});

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
    const res = await api.post<{ token: string }>("signup", {
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
    const res = await api.post<{ token: string }>("login", {
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

const showLogs = process.env.PINO 

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(showLogs && {
    transport: {
      target: 'pino-pretty',
    },
  }),
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
    const res = await api.post("projects/:id/run", {
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
  const projectName = await input({
    message: "It looks like this is your first time running the tool in this project. Give it a name to continue:"
  })

  const res = await api.post<{ id: string }>("projects", {
    json: {
      name: projectName
    },
  })

  const json = await res.json()
  return json.id
}

async function loadConfig() {
  const configPath = path.join(process.cwd(), "config.json")

  try {
    const data = await fs.promises.readFile(configPath, "utf-8")
    return JSON.parse(data)
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