# imgcompare

CLI tool for capturing and comparing visual screenshots across test runs.

## Commands

### `init`

Set up a new project. Creates a `config.json` in the current directory with your server URL and project ID.

```sh
imgcompare init
```

### `login`

Log in to an existing account. Saves your auth token to `~/.imgtoken`.

```sh
imgcompare login
```

### `signup`

Create a new account. Saves your auth token to `~/.imgtoken`.

```sh
imgcompare signup
```

### `exec`

Run a test command and capture screenshots when it completes. Forwards the exit code of the wrapped command.

```sh
imgcompare exec playwright test
imgcompare exec cypress run
```

### `credentials`

Manage CI client credentials for machine authentication. A project owner generates a client ID and secret; CI runners exchange them for a short-lived JWT to authenticate API requests.

**Generate**

Creates a new client ID and secret. The secret is shown once — store it in your CI secrets (e.g. GitHub Actions secrets, GitLab CI variables).

```sh
imgcompare credentials generate
```

**Check**

Shows the active client ID, or tells you if none exists.

```sh
imgcompare credentials check
```

**Revoke**

Revokes the active credential. Required before generating a new one.

```sh
imgcompare credentials revoke
```
