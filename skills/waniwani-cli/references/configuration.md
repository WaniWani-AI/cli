# Configuration

Two layers, both per-project at the repo root:

| File | Purpose | Created by | Commit? |
|---|---|---|---|
| `.waniwani/settings.json` | OAuth tokens + default API URL | `waniwani login` | **No** — `.gitignore` it |
| `waniwani.config.ts` | Project bindings + optional API key, port | `waniwani connect` | **Yes** |

No global config. Everything is local to the project.

## `waniwani.config.ts`

TypeScript file at the repo root. Default-exports an object structurally compatible with `WaniWaniProjectConfig` from `@waniwani/sdk` (so the CLI and SDK read the same file).

Full schema:

```ts
export default {
  // Auth — env var WANIWANI_API_KEY takes precedence over this
  apiKey: process.env.WANIWANI_API_KEY,

  // API URL — defaults to https://app.waniwani.ai
  // Env var WANIWANI_API_URL takes precedence
  apiUrl: "https://app.waniwani.ai",

  // Set by `waniwani connect`
  orgId: "org_...",
  projectId: "proj_...",

  // Optional: default port for `waniwani dev` (defaults to 3000)
  // --port flag overrides this
  devPort: 3000,

  // Used by other tooling (SDK, dashboard sync) — not the CLI directly
  evals: {
    dir: "./evals",
    scenarios: "scenarios.ts",
    mcpServerUrl: "http://localhost:3000/mcp",
  },
  knowledgeBase: {
    dir: "./knowledge-base",
  },
};
```

Every field is optional. Minimal config after `waniwani connect`:

```ts
export default {
  orgId: "org_...",
  projectId: "proj_...",
};
```

The CLI only reads four fields: `apiKey`, `apiUrl`, `orgId`, `projectId`, `devPort`. Everything else is for the SDK or the dashboard sync.

### How `waniwani connect` writes this file

- File doesn't exist → creates it with `orgId` + `projectId`.
- File exists, default export is an object literal → injects/updates the two keys in place. Comments and other fields are preserved.
- File exists, default export is wrapped in `defineConfig(...)` → same in-place injection.
- File exists in some other shape → prints a snippet for manual paste.

You can edit the file by hand at any time. The CLI won't complain about extra fields.

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
2. `apiKey` field in `waniwani.config.ts`

If neither is set, OAuth token from `.waniwani/settings.json` is used. See [authentication.md](authentication.md) for the OAuth flow.

### API URL

1. `WANIWANI_API_URL` env var
2. `apiUrl` in `waniwani.config.ts`
3. `apiUrl` in `.waniwani/settings.json`
4. Default `https://app.waniwani.ai`

The default-of-defaults is prod. Override on a per-shell basis via the env var, or persist in `waniwani.config.ts` for a project pinned to staging.

### Dev port (`waniwani dev`)

1. `--port <n>` flag
2. `devPort` in `waniwani.config.ts`
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

Each project has its own `.waniwani/` and its own `waniwani.config.ts`. Switching projects is a `cd`. Switching orgs is `waniwani connect` again (it'll re-prompt for org choice).

If you work in multiple WaniWani envs (prod + staging), the cleanest setup is one `waniwani.config.ts` per project with `apiUrl` pinned, plus separate `waniwani login` runs in each project directory (each gets its own tokens scoped to the right env).

## What's intentionally not configurable

- **Heartbeat interval** for `waniwani dev` (hardcoded 30s).
- **Readiness timeout** for `waniwani dev` (hardcoded 30s).
- **OAuth callback port** (hardcoded `54321`). If it's in use, kill the other CLI instance.
- **Package manager detection logic** for `waniwani dev` (lockfile-based, deterministic).

These are intentional simplifications. If one of them blocks you, file an issue rather than working around it.
