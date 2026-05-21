---
name: waniwani-cli
description: "WaniWani CLI (`@waniwani/cli`, binary `waniwani`): connect a local repo to a managed or external MCP agent on app.waniwani.ai, run the MCP locally and connect it to the hosted playground via local mode. Trigger when the user wants to log in, link a project, run their MCP locally with the WaniWani playground, debug auth/token issues, or configure `waniwani.json`. The CLI ships only the four commands `login`, `logout`, `connect`, `dev` — anything else is the SDK or the dashboard."
license: MIT
metadata:
  author: WaniWani
---

# WaniWani CLI (`@waniwani/cli`)

The thin local tool that talks to [app.waniwani.ai](https://app.waniwani.ai). Four commands:

| Command | Purpose |
|---|---|
| `waniwani login` | OAuth2 PKCE login — stores tokens in `.waniwani/settings.json` |
| `waniwani logout` | Clears stored credentials |
| `waniwani connect` | Links the current repo to a managed or external MCP agent. Writes `waniwani.json` |
| `waniwani dev` | Spawns the user's MCP, registers a dev session, opens the playground in local mode |

Anything beyond these four lives elsewhere — building MCP flows is the [`@waniwani/sdk`](https://www.npmjs.com/package/@waniwani/sdk), and project/agent management is the dashboard.

## Install

Recommended — invoke directly with `bunx` (no install required):

```bash
bunx @waniwani/cli@latest <command>
```

Or install globally:

```bash
bun install -g @waniwani/cli
# then
waniwani <command>
```

`npm` and `pnpm` work too — the CLI ships as a plain Node ESM binary.

## Typical first-time flow

1. `bunx @waniwani/cli@latest login` — opens the browser, completes OAuth, stores tokens locally.
2. `bunx @waniwani/cli@latest connect` — pick an org, pick or create an agent, writes `waniwani.json` at the repo root.
3. `bunx @waniwani/cli@latest dev` — spawns your MCP via `bun/pnpm/yarn/npm run dev`, registers the local server with WaniWani, opens the playground in local mode.

The full guided walkthrough lives at [scripts/first-time-setup.md](scripts/first-time-setup.md).

## Configuration

Two layers, both at the repo root:

- **`.waniwani/settings.json`** — OAuth tokens, client ID, default API URL. Created by `waniwani login`. Per-project (no global config).
- **`waniwani.json`** — project bindings (`orgId`, `projectId`), optional `apiKey`, `apiUrl`, `devPort`. Created by `waniwani connect`. Shared in shape with `@waniwani/sdk`.

Full schema and precedence rules: [references/configuration.md](references/configuration.md).

## Auth precedence

1. `WANIWANI_API_KEY` env var (highest — used in CI / hosted servers)
2. `apiKey` in `waniwani.json`
3. OAuth access token from `.waniwani/settings.json` (with auto-refresh on 401)

Detailed model + token refresh + when to use which: [references/authentication.md](references/authentication.md).

## API URL precedence

1. `WANIWANI_API_URL` env var
2. `apiUrl` in `waniwani.json`
3. `apiUrl` in `.waniwani/settings.json`
4. Default `https://app.waniwani.ai`

Useful for pointing at a staging environment (`https://dev.waniwani.ai`) without rewriting config.

## Output flags

Both global, available on every command:

- `--json` — machine-readable JSON output. Errors come out as `{ success: false, error: { code, message, details } }`. **`waniwani dev` does not support `--json`** (it's interactive and long-running).
- `--verbose` — extra logging. Mostly useful for debugging API request failures.

## Reading guide

| You want to... | Read |
|---|---|
| Set up a new project end-to-end | [scripts/first-time-setup.md](scripts/first-time-setup.md) |
| Understand auth (OAuth vs API key, refresh) | [references/authentication.md](references/authentication.md) |
| Understand config files and precedence | [references/configuration.md](references/configuration.md) |
| Run your MCP locally and connect to the playground | [references/dev.md](references/dev.md) |

## Common mistakes

- **Running `waniwani connect` before `waniwani login`** — connect requires auth. The error message tells you to log in first; do that, then re-run.
- **Pointing `WANIWANI_API_URL` at staging without re-logging in** — OAuth tokens are scoped to the env they were issued in. If you switch from prod to staging (or vice versa), `waniwani logout && waniwani login` to get tokens for the new env.
- **Expecting `.waniwani/` to be committed** — it stores OAuth tokens. Add it to `.gitignore`. `waniwani.json` *is* meant to be committed (it's just project bindings, no secrets).
- **Trying to pass `--json` to `waniwani dev`** — `dev` is interactive (spawns a child process, opens a browser, runs until Ctrl-C). It refuses `--json` with a clear error. Use the other commands programmatically instead.
- **Not respecting `PORT` in your dev script** — `waniwani dev` sets `PORT=<port>` on the spawned process. If your dev script hardcodes a different port, the readiness poll will time out. Either honor `PORT` or pass `waniwani dev --port <actual-port>`.
- **Re-running `waniwani connect` after writing `waniwani.json` by hand** — it'll prompt to switch projects. If your hand-written config is correct, decline; the existing binding stays.
