# Configuration

Two layers, both per-project at the repo root:

| File | Purpose | Created by | Commit? |
|---|---|---|---|
| `.waniwani/settings.json` | OAuth tokens + default API URL | `waniwani login` | **No** — `.gitignore` it |
| `waniwani.json` | Project bindings + optional API key, port | `waniwani connect` | **Yes** |

No global config. Everything is local to the project.

## `waniwani.json`

JSON file at the repo root. Validated against the JSON Schema hosted at `https://app.waniwani.ai/waniwani.json` — set `$schema` for editor autocomplete and validation in VS Code, JetBrains, and any LSP-aware editor. The CLI and the `@waniwani/sdk` runtime both read the same file.

Full shape:

```json
{
  "$schema": "https://app.waniwani.ai/waniwani.json",
  "orgId": "org_...",
  "projectId": "proj_...",
  "apiUrl": "https://app.waniwani.ai",
  "devPort": 3000
}
```

Every field except `$schema` is optional. Minimal config after `waniwani connect`:

```json
{
  "$schema": "https://app.waniwani.ai/waniwani.json",
  "orgId": "org_...",
  "projectId": "proj_..."
}
```

`apiKey` is sourced from `WANIWANI_API_KEY` in the environment — JSON can't reference env vars, and keys shouldn't sit in checked-in files anyway.

### How `waniwani connect` writes this file

- `waniwani.json` doesn't exist → creates it with `$schema`, `orgId`, `projectId`.
- `waniwani.json` exists → merges `orgId`/`projectId` in (preserves all other keys). If parsing fails, prints a snippet for manual paste.
- Legacy `waniwani.config.ts` exists → after writing `waniwani.json`, deletes the `.ts` file. Print confirms the removal.

You can edit the file by hand at any time. The CLI won't complain about extra fields.

### Legacy `waniwani.config.ts`

Older projects shipped a `waniwani.config.ts` with `defineConfig({...})` from `@waniwani/sdk`. The CLI still reads it as a fallback (with a deprecation warning on stderr), but new writes always produce `waniwani.json`. Run `waniwani connect` once to migrate.

## `.waniwani/settings.json`

JSON file managed entirely by the CLI. Schema:

```json
{
  "apiUrl": "https://app.waniwani.ai",
  "accessToken": "ey...",
  "refreshToken": "ey...",
  "expiresAt": "2026-05-15T10:30:00.000Z",
  "clientId": "wanicli_..."
}
```

| Field | Set by | Used by |
|---|---|---|
| `apiUrl` | login (default) | All API requests |
| `accessToken` | login / refresh | OAuth fallback when no API key |
| `refreshToken` | login | Auto-refresh on 401 |
| `expiresAt` | login / refresh | Pre-emptive refresh (5-min buffer) |
| `clientId` | login | Required to refresh tokens |

`waniwani logout` nulls the auth fields (`accessToken`, `refreshToken`, `expiresAt`, `clientId`) but keeps `apiUrl`.

## Precedence

### API key (auth)

1. `WANIWANI_API_KEY` env var

If unset, OAuth token from `.waniwani/settings.json` is used. See [authentication.md](authentication.md) for the OAuth flow.

### API URL

1. `WANIWANI_API_URL` env var
2. `apiUrl` in `waniwani.json`
3. `apiUrl` in `.waniwani/settings.json`
4. Default `https://app.waniwani.ai`

The default-of-defaults is prod. Override on a per-shell basis via the env var, or persist in `waniwani.json` for a project pinned to staging.

### Dev port (`waniwani dev`)

1. `--port <n>` flag
2. `devPort` in `waniwani.json`
3. Default `3000`

The resolved port is exported as `PORT=<port>` to the spawned MCP process.

## Environment variables

| Var | Used for | Notes |
|---|---|---|
| `WANIWANI_API_KEY` | Auth | Highest priority. Skips OAuth entirely. |
| `WANIWANI_API_URL` | API base URL | Highest priority. Override per-shell or in CI. |
| `PORT` | Read by spawned MCP | Set automatically by `waniwani dev`. Don't set manually. |

No other env vars are read by the CLI.

## Multi-project workflows

Each project has its own `.waniwani/` and its own `waniwani.json`. Switching projects is a `cd`. Switching orgs is `waniwani connect` again (it'll re-prompt for org choice).

If you work in multiple WaniWani envs (prod + staging), the cleanest setup is one `waniwani.json` per project with `apiUrl` pinned, plus separate `waniwani login` runs in each project directory (each gets its own tokens scoped to the right env).

## What's intentionally not configurable

- **Heartbeat interval** for `waniwani dev` (hardcoded 30s).
- **Readiness timeout** for `waniwani dev` (hardcoded 30s).
- **OAuth callback port** (hardcoded `54321`). If it's in use, kill the other CLI instance.
- **Package manager detection logic** for `waniwani dev` (lockfile-based, deterministic).

These are intentional simplifications. If one of them blocks you, file an issue rather than working around it.
