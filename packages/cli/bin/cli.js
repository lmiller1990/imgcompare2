#!/usr/bin/env node
import { spawn } from "node:child_process";
import debugLib from "debug";
import { globby } from "globby";
import { simpleGit } from "simple-git";
import { input, password as passwordPrompt } from "@inquirer/prompts";
import fs from "fs";
import path from "node:path";
import ky from "ky";
import os from "os";
const debug = debugLib("imgcompare:cli");
const TOKEN_PATH = path.join(os.homedir(), ".imgtoken");
const api = ky.extend({
  baseUrl:
    process.env.SERVER_URL ?? "https://imgcompare.lachlan-miller.me/api/",
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        const token = await getStoredToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
export async function maybeGetGitInfo() {
  try {
    const git = simpleGit();
    const log = await git.log({ maxCount: 1 });
    const branchSummary = await git.branch();
    const latest = log.latest;
    if (!latest) {
      debug("Use is not using git. Ignoring.");
      return;
    }
    return {
      hash: latest.hash,
      authorName: latest.author_name,
      authorEmail: latest.author_email,
      branch: branchSummary.current,
    };
  } catch (e) {
    debug(
      "Use is not using git, or another error in getting git info. Ignoring. Error was %s",
      e,
    );
  }
}
async function getStoredToken() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  try {
    const data = JSON.parse(await fs.promises.readFile(TOKEN_PATH, "utf-8"));
    return data.token;
  } catch {
    //
  }
}
async function saveToken(token) {
  fs.promises.writeFile(TOKEN_PATH, JSON.stringify({ token }), {
    mode: 0o600,
  });
}
async function signup() {
  const { email, password } = await promptCredentials();
  try {
    const res = await api.post("signup", {
      json: {
        email,
        password,
      },
    });
    await saveToken((await res.json()).token);
    console.log("Welcome aboard!");
  } catch (error) {
    console.error(`Error occurred: ${error}`);
    debug("Error %s", error);
    //
  }
}
async function login() {
  const { email, password } = await promptCredentials();
  try {
    const res = await api.post("login", {
      json: {
        email,
        password,
      },
    });
    await saveToken((await res.json()).token);
    console.log("Logged in.");
  } catch (error) {
    console.error("Invalid email or password. Error %s");
  }
}
async function createRun(projectId, gitinfo) {
  debug("Creating run... projectId: %s gitinfo: %o", projectId, gitinfo);
  try {
    const res = await (
      await api.post(`projects/${projectId}/runs`, {
        json: { gitinfo },
      })
    ).json();
    return res;
  } catch (e) {
    debug("Failed to start run: %s", e);
    console.error("Failed to initialize run. Aborting.");
    process.exit();
  }
}
async function findAllScreenshots(cwd) {
  const files = await globby(path.posix.join(cwd, "**/*.png"));
  debug("Found files %o", files);
  return files;
}
async function postScreenshots(cwd, projectId, runId, files) {
  files = files.map((file) => path.relative(cwd, file));
  const form = new FormData();
  debug("Posting files %o", files);
  form.append("manifest", JSON.stringify(files));
  for (const path of files) {
    const buffer = await fs.promises.readFile(path);
    form.append("screenshots", new Blob([buffer]), path.split("/").pop());
  }
  try {
    await api.post(`projects/${projectId}/run/${runId}/finalize`, {
      body: form,
    });
  } catch (error) {
    debug("Error posting to server: %s", error);
    //
  }
}
export async function promptCredentials() {
  const email = await input({
    message: "Enter your email",
    required: true,
  });
  const password = await passwordPrompt({
    message: "Enter a password",
  });
  return { email, password };
}
async function createNewProject() {
  const projectName = await input({
    message:
      "It looks like this is your first time running the tool in this project. Give it a name to continue:",
  });
  const res = await api.post("projects", {
    json: {
      name: projectName,
    },
  });
  const json = await res.json();
  return json.id;
}
async function loadConfig() {
  const configPath = path.join(process.cwd(), "config.json");
  try {
    const data = await fs.promises.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    const e = err;
    if (e.code === "ENOENT") {
      const projectId = await createNewProject();
      const defaultConfig = { projectId };
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8",
      );
      console.log(`
No config.json found.
A new one has been created at:
  ${configPath}

Please review and update it as needed.
`);
      return defaultConfig;
    }
    // Other errors should not be silently swallowed
    throw e;
  }
}
async function markRunAsComplete(projectId, runId) {
  await api.patch(`projects/${projectId}/run/${runId}`, {
    json: {
      status: "unreviewed",
    },
  });
}
export async function run(process) {
  let cleanArgs = process.argv.slice(2);
  cleanArgs = cleanArgs[0] === "--" ? cleanArgs.slice(1) : cleanArgs;
  debug("Running with cwd %s and args %o", process.cwd(), cleanArgs);
  const [cmd, ...args] = cleanArgs;
  if (!cmd) {
    throw new Error(
      `You need to pass a command, eg pnpm exec <tool> playwright test`,
    );
  }
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(`
exec prefers <cwd>/node_modules/.bin (like pnpm exec)
set IMGCOMPARE_API_URL to point at your server (default: http://localhost)
`);
    return;
  }
  if (cmd === "login") {
    await login();
    return;
  }
  if (cmd === "signup") {
    await signup();
    return;
  }
  const config = await loadConfig();
  debug("Loaded config: %o", config);
  const gitinfo = await maybeGetGitInfo();
  const { id: runId } = await createRun(config.projectId, gitinfo);
  debug("Created a run %s", runId);
  debug("Spawning child process with cmd: %s and args %o", cmd, args);
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", async (code, signal) => {
    debug(`Finished with ${code} and signal: ${signal}`);
    console.log("Run complete. Finalizing screenshots and comparisons...");
    const files = await findAllScreenshots(process.cwd());
    await postScreenshots(process.cwd(), config.projectId, runId, files);
    await markRunAsComplete(config.projectId, runId);
    // forward this to ensure we fail with same status as uses process
    process.exit(code);
  });
  child.on("error", (e) => {
    console.error("Unexpected error occurred. Aborting.");
    debug("Child exited with error: %s", e);
  });
}
run(process);
