#!/usr/bin/env node

import { execa, ExecaError } from "execa";
import debugLib from "debug";
import { globby } from "globby";
import { simpleGit } from "simple-git";
import { input, password as passwordPrompt, select } from "@inquirer/prompts";
import type {
  CiMetadata,
  GitInfo,
  GitLabCiMetadata,
  RunManifest,
} from "@packages/domain/src/domain.js";
import fs from "fs";
import path from "node:path";
import ky, { HTTPError } from "ky";
import os from "os";
import { Command } from "commander";

const debug = debugLib("imgcompare:cli");
const TOKEN_PATH = path.join(os.homedir(), ".imgtoken");
const DEFAULT_SERVER_URL =
  process.env.SERVER_URL ?? "https://imgcompare.lachlan-miller.me/";

function makeApi(baseUrl: string) {
  debug("Making API client with base URL: %s", baseUrl);
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return ky.extend({
    prefix: normalizedBase + "/api",
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          debug("Request to URL %s", request.url, request);
          const token = await getAuthToken(normalizedBase);
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

function getFromGitLabEnvVars(): GitInfo {
  const hash = process.env.CI_COMMIT_SHA ?? "";
  const branch = process.env.CI_COMMIT_REF_NAME ?? "";

  // CI_COMMIT_AUTHOR = "Name <email>"
  const authorRaw = process.env.CI_COMMIT_AUTHOR || "";

  const authorName = authorRaw.replace(/ <.*$/, "") ?? "";
  const authorEmailMatch = authorRaw.match(/<(.*)>/);
  const authorEmail = authorEmailMatch ? authorEmailMatch[1] : "";

  const result: GitInfo = {
    hash,
    authorName,
    authorEmail,
    branch,
  };

  debug("Got git info from gitlab env vars. %o", result);

  return result;
}

async function getFromLocalGit(): Promise<GitInfo | undefined> {
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
}

export async function maybeGetGitInfo(): Promise<GitInfo | undefined> {
  try {
    if (process.env.GITLAB_CI) {
      return getFromGitLabEnvVars();
    } else {
      return await getFromLocalGit();
    }
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

let cachedServiceToken: string | undefined;

async function getServiceToken(baseUrl: string): Promise<string | undefined> {
  const clientId = process.env.IMGCOMPARE_CLIENT_ID;
  const clientSecret = process.env.IMGCOMPARE_CLIENT_SECRET;
  debug(
    "getServiceToken: clientId=%s clientSecret=%s",
    clientId ? "set" : "unset",
    clientSecret ? "set" : "unset",
  );
  if (!clientId || !clientSecret) {
    debug("getServiceToken: client credentials not set, skipping");
    return undefined;
  }

  if (cachedServiceToken) {
    debug("getServiceToken: returning cached token");
    return cachedServiceToken;
  }

  debug("getServiceToken: requesting token from %s", baseUrl);
  const res = await ky.post(`${baseUrl}/api/auth/token`, {
    json: { clientId, clientSecret },
  });
  const { token } = await res.json<{ token: string }>();
  debug("getServiceToken: token acquired");
  cachedServiceToken = token;
  return token;
}

async function getAuthToken(baseUrl: string): Promise<string | undefined> {
  const serviceToken = await getServiceToken(baseUrl);
  if (serviceToken) return serviceToken;
  return getStoredToken();
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

interface InitOptions {
  serverUrl?: string;
  email?: string;
  password?: string;
  projectName?: string;
}

async function init(options: InitOptions) {
  const configPath = path.join(process.cwd(), "config.json");

  if (fs.existsSync(configPath)) {
    console.log("config.json already exists. Nothing to do.");
    return;
  }

  const rawUrl =
    options.serverUrl ??
    (await input({
      message: "Server URL",
      default: "https://imgcompare.lachlan-miller.me/",
    }));
  let serverUrl = normalizeServerUrl(rawUrl);
  const authApi = makeApi(serverUrl);
  debug("Created auth API client with url %s", serverUrl);

  const email =
    options.email ??
    (await input({ message: "Enter your email", required: true }));
  const password =
    options.password ?? (await passwordPrompt({ message: "Enter a password" }));

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

  const projectName =
    options.projectName ??
    (await input({
      message: "Project name",
      required: true,
    }));

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

async function markRunAsComplete(projectId: string, runId: string) {
  // TODO why double request here - can we just have one
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

  // I want to run on CI to test the local experience. So we "pretend" not to be CI
  const ciMetadata = process.env.PRETEND_NOT_CI
    ? undefined
    : maybeCollectCiMetadata();
  const { id: runId } = await createRun(config.projectId, gitinfo, ciMetadata);
  debug("Created a run %s", runId);

  debug("Spawning child process with cmd: %s and args %o", cmd, cmdArgs);

  let exitCode = 0;
  try {
    await execa(cmd, cmdArgs, {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${path.join(process.cwd(), "node_modules/.bin")}:${process.env.PATH}`,
      },
    });
  } catch (e) {
    if (e instanceof ExecaError) {
      debug("Child exited with code %d", e.exitCode);
      exitCode = e.exitCode ?? 1;
    } else {
      console.error("Unexpected error occurred. Aborting.");
      debug("Child exited with error: %s", e);
      process.exit(1);
    }
  }

  console.log("Run complete. Finalizing screenshots and comparisons...");
  const files = await findAllScreenshots(process.cwd());
  await postScreenshots(process.cwd(), config.projectId, runId, files);

  // kick of the processing
  await api.post(`/projects/${config.projectId}/run/${runId}/finalize`);
  process.exit(exitCode);
}

function handleCredentialError(e: unknown, action: string) {
  if (e instanceof HTTPError) {
    if (e.response.status === 401) {
      console.error(
        "Not authenticated. Run `imgcompare login` to log in first.",
      );
      return;
    }
    if (e.response.status === 409 && action === "generate") {
      console.error(`A credential already exists for this project.

  Run \`imgcompare credentials check\` to see the active client ID.
  Run \`imgcompare credentials revoke\` to remove it, then generate a new one.`);
      return;
    }
    if (e.response.status === 404) {
      console.error(
        `No active credential found. Run \`imgcompare credentials generate\` to create one.`,
      );
      return;
    }
  }
  console.error(`Unexpected error: ${e}`);
}

async function credentialsGenerate() {
  const config = await loadConfig();
  if (config.serverUrl) {
    api = makeApi(config.serverUrl);
  }

  try {
    const res = await api.post<{ clientId: string; clientSecret: string }>(
      `/projects/${config.projectId}/credentials`,
    );
    const { clientId, clientSecret } = await res.json();
    console.log(`Client credentials generated.

  Client ID:     ${clientId}
  Client Secret: ${clientSecret}

Store the secret securely — it will not be shown again.`);
  } catch (e) {
    handleCredentialError(e, "generate");
    process.exit(1);
  }
}

async function credentialsCheck() {
  const config = await loadConfig();
  if (config.serverUrl) {
    api = makeApi(config.serverUrl);
  }

  try {
    const res = await api.get<{ clientId: string }>(
      `/projects/${config.projectId}/credentials`,
    );
    const { clientId } = await res.json();
    console.log(`Active credential found.

  Client ID: ${clientId}

To remove it, run \`imgcompare credentials revoke\`.`);
  } catch (e) {
    handleCredentialError(e, "check");
    process.exit(1);
  }
}

async function credentialsRevoke() {
  const config = await loadConfig();
  if (config.serverUrl) {
    api = makeApi(config.serverUrl);
  }

  try {
    await api.delete(`/projects/${config.projectId}/credentials`);
    console.log(
      `Credential revoked. Run \`imgcompare credentials generate\` to create a new one.`,
    );
  } catch (e) {
    handleCredentialError(e, "revoke");
    process.exit(1);
  }
}

const SUPPORTED_PROVIDERS = [{ value: "gitlab", name: "GitLab" }] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number]["value"];

function handleTokenError(e: unknown, action: string) {
  if (e instanceof HTTPError) {
    if (e.response.status === 401) {
      console.error(
        "Not authenticated. Run `imgcompare login` to log in first.",
      );
      return;
    }
    if (e.response.status === 404 && action !== "save") {
      console.error("No token saved. Run `imgcompare token save` to add one.");
      return;
    }
  }
  console.error(`Unexpected error: ${e}`);
}

interface TokenSaveOptions {
  provider?: Provider;
  force?: boolean;
}

async function tokenSave(options: TokenSaveOptions) {
  const config = await loadConfig();
  if (config.serverUrl) {
    api = makeApi(config.serverUrl);
  }

  const provider: Provider =
    options.provider ??
    (await select({
      message: "Select CI provider",
      choices: SUPPORTED_PROVIDERS,
    }));

  if (!options.force) {
    try {
      const existing = await api
        .get<{
          hint: string;
          provider: string;
        }>(`/projects/${config.projectId}/token/${provider}`)
        .json();
      console.log(`A token is already saved for this project.

  Provider: ${existing.provider}
  Token:    ${existing.hint}

  To replace it, run \`imgcompare token save --force\`.`);
      return;
    } catch (e) {
      if (!(e instanceof HTTPError) || e.response.status !== 404) {
        handleTokenError(e, "save");
        process.exit(1);
      }
    }
  }

  const token = await passwordPrompt({
    message: `Paste your ${provider} project token`,
  });

  try {
    await api.post(`/projects/${config.projectId}/token`, {
      json: { provider, token },
    });
    console.log(`Token saved.

  Provider: ${provider}
  Token:    ${token.slice(0, 6)}...${token.slice(-4)}

  Store this token securely in your CI/CD secrets.`);
  } catch (e) {
    handleTokenError(e, "save");
    process.exit(1);
  }
}

interface TokenProviderOptions {
  provider?: Provider;
}

async function resolveProvider(
  options: TokenProviderOptions,
): Promise<Provider> {
  return (
    options.provider ??
    (await select({
      message: "Select CI provider",
      choices: SUPPORTED_PROVIDERS,
    }))
  );
}

async function tokenCheck(options: TokenProviderOptions) {
  const config = await loadConfig();
  if (config.serverUrl) {
    api = makeApi(config.serverUrl);
  }

  const provider = await resolveProvider(options);

  try {
    const { hint } = await api
      .get<{ hint: string }>(`/projects/${config.projectId}/token/${provider}`)
      .json();
    console.log(`A token is saved for this project.

  Provider: ${provider}
  Token:    ${hint}

  To replace it, run \`imgcompare token save --force\`.
  To remove it, run \`imgcompare token revoke\`.`);
  } catch (e) {
    handleTokenError(e, "check");
    process.exit(1);
  }
}

async function tokenRevoke(options: TokenProviderOptions) {
  const config = await loadConfig();
  if (config.serverUrl) {
    api = makeApi(config.serverUrl);
  }

  const provider = await resolveProvider(options);

  try {
    await api.delete(`/projects/${config.projectId}/token/${provider}`);
    console.log("Token revoked. Run `imgcompare token save` to add a new one.");
  } catch (e) {
    handleTokenError(e, "revoke");
    process.exit(1);
  }
}

const program = new Command("imgcompare");

program.description("Visual regression testing CLI");

program
  .command("init")
  .description("Initialize a new project")
  .option("--server-url <url>", "Server URL")
  .option("--email <email>", "Account email")
  .option("--password <password>", "Account password")
  .option("--project-name <name>", "Project name")
  .action(init);

program.command("login").description("Log in to your account").action(login);

program.command("signup").description("Create a new account").action(signup);

program
  .command("exec")
  .description("Run a test command and capture screenshots")
  .argument("[args...]")
  .allowUnknownOption()
  .action(exec);

const credentials = program
  .command("credentials")
  .description("Manage CI client credentials for this project");

credentials
  .command("generate")
  .description(
    "Generate a client ID and secret for CI authentication. The secret is shown once — store it in your CI secrets.",
  )
  .action(credentialsGenerate);

credentials
  .command("check")
  .description(
    "Check whether an active client credential exists for this project.",
  )
  .action(credentialsCheck);

credentials
  .command("revoke")
  .description(
    "Revoke the active client credential. Required before generating a new one.",
  )
  .action(credentialsRevoke);

const token = program
  .command("token")
  .description("Manage CI provider tokens for this project");

token
  .command("save")
  .description("Save or rotate a CI provider token for this project.")
  .option("--provider <provider>", "CI provider (e.g. gitlab)")
  .option("--force", "Overwrite an existing token without prompting")
  .action(tokenSave);

token
  .command("check")
  .description("Check whether a CI provider token is saved for this project.")
  .option("--provider <provider>", "CI provider (e.g. gitlab)")
  .action(tokenCheck);

token
  .command("revoke")
  .description("Remove the saved CI provider token for this project.")
  .option("--provider <provider>", "CI provider (e.g. gitlab)")
  .action(tokenRevoke);

program.parse();
