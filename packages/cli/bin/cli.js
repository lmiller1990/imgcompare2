#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { globby } from "globby";
import { execa } from "execa";
import { simpleGit } from "simple-git";
import { input, password as passwordPrompt } from "@inquirer/prompts";
import pino from "pino";
import ky from "ky";

const TOKEN_PATH = path.join(os.homedir(), ".imgtoken");

const API_URL = process.env.IMGCOMPARE_API_URL ?? "http://localhost:8070";

const api = ky.extend({
  prefixUrl: API_URL,
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        const token = await getStoredToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
  },
});

const showLogs = process.env.PINO;
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(showLogs && {
    transport: {
      target: "pino-pretty",
    },
  }),
});

async function getStoredToken() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  try {
    const data = JSON.parse(await fs.promises.readFile(TOKEN_PATH, "utf-8"));
    return data.token;
  } catch {
    return null;
  }
}

async function saveToken(token) {
  await fs.promises.writeFile(TOKEN_PATH, JSON.stringify({ token }), {
    mode: 0o600,
  });
}

async function promptCredentials() {
  const email = await input({ message: "Enter your email", required: true });
  const password = await passwordPrompt({ message: "Enter a password" });
  return { email, password };
}

async function signup() {
  const { email, password } = await promptCredentials();
  try {
    const res = await api.post("signup", { json: { email, password } });
    const json = await res.json();
    await saveToken(json.token);
    console.log("Welcome aboard!");
  } catch (error) {
    logger.child({ error }).error("Error posting to server");
    process.exitCode = 1;
  }
}

async function login() {
  const { email, password } = await promptCredentials();
  try {
    const res = await api.post("login", { json: { email, password } });
    const json = await res.json();
    await saveToken(json.token);
    console.log("Logged in.");
  } catch (error) {
    console.error("Invalid email or password.");
    logger.child({ error }).error("Error posting to server");
    process.exitCode = 1;
  }
}

async function getGitInfo() {
  try {
    const git = simpleGit();
    const log = await git.log({ maxCount: 1 });
    const branchSummary = await git.branch();
    const latest = log.latest;
    if (!latest) return undefined;
    return {
      hash: latest.hash,
      authorName: latest.author_name,
      authorEmail: latest.author_email,
      branch: branchSummary.current,
    };
  } catch (error) {
    logger.child({ error }).debug("Not a git repo. Ignoring git info.");
    return undefined;
  }
}

async function createRun(projectId) {
  const gitinfo = await getGitInfo();
  const res = await api.post(`projects/${projectId}/runs`, { json: { gitinfo } });
  return res.json();
}

async function createNewProject() {
  const projectName = await input({
    message:
      "It looks like this is your first time running the tool in this project. Give it a name to continue:",
  });
  const res = await api.post("projects", { json: { name: projectName } });
  const json = await res.json();
  return json.id;
}

async function loadConfig(cwd) {
  const configPath = path.join(cwd, "config.json");
  try {
    const data = await fs.promises.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    const e = err;
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
      const projectId = await createNewProject();
      const defaultConfig = { projectId };
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8",
      );
      console.log(`\nNo config.json found.\nA new one has been created at:\n  ${configPath}\n`);
      return defaultConfig;
    }
    throw e;
  }
}

async function findAllScreenshots(cwd) {
  // Keep the deployed/installed CLI simple: scan for pngs under cwd.
  const files = await globby(path.posix.join(cwd, "**/*.png"));
  return files;
}

async function postScreenshots(cwd, projectId, runId, files) {
  const relFiles = files.map((file) => path.relative(cwd, file));
  const form = new FormData();
  form.append("manifest", JSON.stringify(relFiles));

  for (const relPath of relFiles) {
    const absPath = path.join(cwd, relPath);
    const buffer = await fs.promises.readFile(absPath);
    form.append("screenshots", new Blob([buffer]), path.basename(relPath));
  }

  await api.post(`projects/${projectId}/run/${runId}/finalize`, {
    body: form,
  });
}

async function markRunAsComplete(projectId, runId) {
  await api.patch(`projects/${projectId}/run/${runId}`, {
    json: { status: "unreviewed" },
  });
}

function printHelp() {
  console.log(`imgcompare\n\nUsage:\n  imgcompare login\n  imgcompare signup\n  imgcompare exec <bin> [...args]\n\nNotes:\n  - exec prefers <cwd>/node_modules/.bin (like pnpm exec)\n  - set IMGCOMPARE_API_URL to point at your server (default: http://localhost:8070)\n`);
}

async function execCommand(argv) {
  const cwd = process.cwd();
  const cleaned = argv[0] === "--" ? argv.slice(1) : argv;
  const [bin, ...args] = cleaned;

  if (!bin) {
    console.error("Missing command. Example: imgcompare exec playwright test");
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(cwd);
  const { id: runId } = await createRun(config.projectId);

  let exitCode = 1;
  try {
    const res = await execa(bin, args, {
      cwd,
      stdio: "inherit",
      preferLocal: true,
      localDir: cwd,
      reject: false,
    });
    exitCode = res.exitCode ?? 0;
  } catch (error) {
    // Usually ENOENT (binary not found). Execa doesn't convert that to an exit code.
    logger.child({ error, bin, args, cwd }).error("Failed to execute command");
    console.error(`\nCould not run '${bin}'. Is it installed in this project (node_modules/.bin)?`);
    process.exitCode = 1;
    return;
  }

  try {
    const files = await findAllScreenshots(cwd);
    await postScreenshots(cwd, config.projectId, runId, files);
    await markRunAsComplete(config.projectId, runId);
  } catch (error) {
    logger.child({ error }).error("Failed uploading screenshots");
    // Keep the original command status if it failed; otherwise fail.
    if (exitCode === 0) exitCode = 1;
  }

  process.exit(exitCode);
}

async function main() {
  const argv = process.argv.slice(2);
  const clean = argv[0] === "--" ? argv.slice(1) : argv;
  const [cmd, ...rest] = clean;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  if (cmd === "login") return login();
  if (cmd === "signup") return signup();
  if (cmd === "exec") return execCommand(rest);

  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exitCode = 1;
}

await main();
