#!/usr/bin/env node

import { spawn } from "node:child_process";
import debugLib from "debug";
import { globby } from "globby";
import { simpleGit } from "simple-git";
import { input, password as passwordPrompt } from "@inquirer/prompts";
import type {
  CiMetadata,
  GitInfo,
  GitLabCiMetadata,
  RunManifest,
} from "@packages/domain/src/domain.js";
import fs from "fs";
import path from "node:path";
import ky from "ky";
import os from "os";
import cac from "cac";

const debug = debugLib("imgcompare:cli");
const TOKEN_PATH = path.join(os.homedir(), ".imgtoken");
const DEFAULT_SERVER_URL =
  process.env.SERVER_URL ?? "https://imgcompare.lachlan-miller.me/";

function makeApi(baseUrl: string) {
  debug("Making API client with base URL: %s", baseUrl);
  return ky.extend({
    prefix: baseUrl.replace(/\/+$/, "") + "/api",
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          debug("Request to URL %s", request.url, request);
          const token = await getStoredToken();
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
        },
      ],
    },
  });
}

let api = makeApi(DEFAULT_SERVER_URL);

function maybeCollectCiMetadata(): CiMetadata | undefined {
  if (process.env.GITLAB_CI) {
    const metadata: GitLabCiMetadata = {
      provider: "gitlab",
      ci_project_id: process.env.GITLAB_CI,
    };
    return metadata;
  }

  return undefined;
}

export async function maybeGetGitInfo(): Promise<GitInfo | undefined> {
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

interface TokenFile {
  token: string;
  projects?: Record<string, { token: string }>;
}

async function getStoredToken() {
  if (!fs.existsSync(TOKEN_PATH)) return undefined;
  try {
    const data: TokenFile = JSON.parse(
      await fs.promises.readFile(TOKEN_PATH, "utf-8"),
    );
    return data.token;
  } catch {
    //
  }
}

async function saveToken(token: string, projectId?: string) {
  let existing: TokenFile = { token };
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      existing = JSON.parse(await fs.promises.readFile(TOKEN_PATH, "utf-8"));
    } catch {
      //
    }
  }

  const updated: TokenFile = {
    ...existing,
    token,
    ...(projectId && {
      projects: {
        ...existing.projects,
        [projectId]: { token },
      },
    }),
  };

  await fs.promises.writeFile(TOKEN_PATH, JSON.stringify(updated), {
    mode: 0o600,
  });
}

async function maybeReadLocalConfig(): Promise<
  { projectId?: string; serverUrl?: string } | undefined
> {
  try {
    const data = await fs.promises.readFile(
      path.join(process.cwd(), "config.json"),
      "utf-8",
    );
    return JSON.parse(data);
  } catch {
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

function normalizeServerUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function init() {
  const configPath = path.join(process.cwd(), "config.json");

  if (fs.existsSync(configPath)) {
    console.log("config.json already exists. Nothing to do.");
    return;
  }

  const rawUrl = await input({
    message: "Server URL",
    default: "https://imgcompare.lachlan-miller.me/",
  });
  let serverUrl = normalizeServerUrl(rawUrl);
  const authApi = makeApi(serverUrl);
  debug("Created auth API client with url %s", serverUrl);

  const { email, password } = await promptCredentials();

  let token: string | undefined;

  try {
    const res = await authApi.post<{ token: string }>("/login", {
      json: { email, password },
    });
    token = (await res.json()).token;
  } catch {
    try {
      const res = await authApi.post<{ token: string }>("/signup", {
        json: { email, password },
      });
      token = (await res.json()).token;
    } catch (error) {
      console.error("Failed to authenticate:", error);
      process.exit(1);
    }
  }

  await saveToken(token!);
  const projectApi = makeApi(serverUrl);

  const projectName = await input({
    message: "Project name",
    required: true,
  });

  const res = await projectApi.post<{ id: string }>("/projects", {
    json: { name: projectName },
  });
  const { id: projectId } = await res.json();

  await saveToken(token!, projectId);

  await fs.promises.writeFile(
    configPath,
    JSON.stringify({ projectId, serverUrl }, null, 2),
    "utf-8",
  );

  console.log(`
Welcome! Your project has been initialized.

  Project: ${projectName}
  Server:  ${serverUrl}
  Config:  ${configPath}

Run your tests with: imgcompare exec <test-command>
`);
}

async function signup() {
  const localConfig = await maybeReadLocalConfig();
  const serverUrl = localConfig?.serverUrl ?? DEFAULT_SERVER_URL;
  const authApi = makeApi(serverUrl);

  const { email, password } = await promptCredentials();
  try {
    const res = await authApi.post<{ token: string }>("/signup", {
      json: { email, password },
    });
    await saveToken((await res.json()).token, localConfig?.projectId);
    console.log("Welcome aboard!");
  } catch (error) {
    console.error(`Error occurred: ${error}`);
    debug("Error %s", error);
  }
}

async function login() {
  const localConfig = await maybeReadLocalConfig();
  const serverUrl = localConfig?.serverUrl ?? DEFAULT_SERVER_URL;
  const authApi = makeApi(serverUrl);

  const { email, password } = await promptCredentials();
  try {
    const res = await authApi.post<{ token: string }>("/login", {
      json: { email, password },
    });
    await saveToken((await res.json()).token, localConfig?.projectId);
    console.log("Logged in.");
  } catch (error) {
    console.error("Invalid email or password. Error %s");
  }
}

async function createRun(
  projectId: string,
  gitinfo?: GitInfo,
  ciMetadata?: CiMetadata,
) {
  debug("Creating run... projectId: %s gitinfo: %o", projectId, gitinfo);
  try {
    const res = await (
      await api.post<{ id: string }>(`/projects/${projectId}/runs`, {
        json: { gitinfo, ciMetadata },
      })
    ).json();
    return res;
  } catch (e) {
    debug("Failed to start run: %s", e);
    console.error("Failed to initialize run. Aborting.");
    process.exit();
  }
}

async function findAllScreenshots(cwd: string) {
  const files = await globby(path.posix.join(cwd, "**/*.png"));
  debug("Found files %o", files);
  return files;
}

export function postScreenshot() {
  //
}

async function postScreenshots(
  cwd: string,
  projectId: string,
  runId: string,
  files: string[],
) {
  const screenshots: RunManifest["screenshots"] = files.map((file) => {
    return { fullPath: file, name: path.relative(cwd, file) };
  });

  debug("Posting files %o", files);

  const manifest: RunManifest = {
    screenshots,
  };

  await api.post(`/projects/${projectId}/run/${runId}/precommit`, {
    json: manifest,
  });

  for (const ss of screenshots) {
    const buffer = await fs.promises.readFile(ss.fullPath);

    try {
      await api.post(`/projects/${projectId}/run/${runId}/screenshots`, {
        body: buffer,
        headers: {
          "content-type": "image/png",
          "x-path": ss.fullPath,
          "x-name": ss.name,
        },
      });
    } catch (error) {
      debug("Error posting to server: %s", error);
    }
  }
}

async function createNewProject() {
  const projectName = await input({
    message:
      "It looks like this is your first time running the tool in this project. Give it a name to continue:",
  });

  const res = await api.post<{ id: string }>("/projects", {
    json: {
      name: projectName,
    },
  });

  const json = await res.json();
  return json.id;
}

async function loadConfig(): Promise<{
  projectId: string;
  serverUrl?: string;
}> {
  const configPath = path.join(process.cwd(), "config.json");

  try {
    const data = await fs.promises.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;

    if (e.code === "ENOENT") {
      const projectId = await createNewProject();

      const defaultConfig = { projectId, serverUrl: DEFAULT_SERVER_URL };
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

    throw e;
  }
}

async function markRunAsComplete(projectId: string, runId: string) {
  // TODO why double request here - can we just have one
  await api.patch(`/projects/${projectId}/run/${runId}`, {
    json: {
      status: "unreviewed",
    },
  });

  await api.post(`/projects/${projectId}/run/${runId}/finalize`);
}

async function exec(args: string[]) {
  const [cmd, ...cmdArgs] = args;
  if (!cmd) {
    console.error("Usage: imgcompare exec <command> [args...]");
    process.exit(1);
    return;
  }

  const config = await loadConfig();
  debug("Loaded config: %o", config);

  if (config.serverUrl) {
    api = makeApi(config.serverUrl);
  }

  const gitinfo = await maybeGetGitInfo();
  const ciMetadata = maybeCollectCiMetadata();
  const { id: runId } = await createRun(config.projectId, gitinfo, ciMetadata);
  debug("Created a run %s", runId);

  debug("Spawning child process with cmd: %s and args %o", cmd, cmdArgs);

  const fullCmd = cmdArgs.length > 0 ? `${cmd} ${cmdArgs.join(" ")}` : cmd;
  const child = spawn(fullCmd, {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      PATH: `${path.join(process.cwd(), "node_modules/.bin")}:${process.env.PATH}`,
    },
  });

  child.on("exit", async (code, signal) => {
    debug(`Finished with ${code} and signal: ${signal}`);
    console.log("Run complete. Finalizing screenshots and comparisons...");

    const files = await findAllScreenshots(process.cwd());
    await postScreenshots(process.cwd(), config.projectId, runId, files);
    await markRunAsComplete(config.projectId, runId);

    process.exit(code);
  });

  child.on("error", (e) => {
    console.error("Unexpected error occurred. Aborting.");
    debug("Child exited with error: %s", e);
  });
}

const cli = cac("imgcompare");

cli
  .command("init", "Initialize a new project")
  .action(init);

cli
  .command("login", "Log in to your account")
  .action(login);

cli
  .command("signup", "Create a new account")
  .action(signup);

cli
  .command("exec [...args]", "Run a test command and capture screenshots")
  .action(exec);

cli.help();
cli.parse();
