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
