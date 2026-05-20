# @waniwani/cli

[![npm](https://img.shields.io/npm/v/@waniwani/cli.svg)](https://www.npmjs.com/package/@waniwani/cli)
[![license](https://img.shields.io/npm/l/@waniwani/cli.svg)](./LICENSE)

The official CLI for **[WaniWani](https://app.waniwani.ai)** — the open-source toolkit for building **MCP funnels**: multi-step conversational flows (sales, lead generation, booking, quotes) that run as a single MCP tool inside ChatGPT, Claude, Cursor, and any MCP-capable client.

`waniwani` connects a local repo to a WaniWani agent in one command, runs your MCP server against the hosted playground.

If you're building an MCP distribution server with the [`@waniwani/sdk`](https://www.npmjs.com/package/@waniwani/sdk), this CLI is the fastest way to wire it to the WaniWani platform without touching a dashboard.

## Install

```bash
# bun
bun add -g @waniwani/cli

# npm
npm install -g @waniwani/cli

# pnpm
pnpm add -g @waniwani/cli

# yarn
yarn global add @waniwani/cli
```

Requires Node.js 20 or later.

## Quickstart

```bash
# 1. Authenticate (browser-based OAuth2 PKCE flow)
waniwani login

# 2. Connect this repo to an agent — picks an org, picks or creates an agent,
#    and writes the binding to waniwani.config.ts
waniwani connect

# 3. Run your MCP locally and open the WaniWani playground against it
waniwani dev
```

Three commands and your local MCP server is talking to ChatGPT/Claude/Cursor through the WaniWani playground. No tunnel setup, no manual dashboard wiring, no copying API keys.

## Commands

| Command | Description |
|---|---|
| `waniwani login` | OAuth2 PKCE login. Opens your browser, stores tokens in `.waniwani/settings.json`. |
| `waniwani logout` | Clear local credentials. |
| `waniwani connect` | Interactive: pick an org, pick or create an agent (managed or external), write the binding to `waniwani.config.ts`. |
| `waniwani dev` | Run your MCP locally (`bun dev` / `npm run dev` / etc.), open the WaniWani playground in your browser, and bridge them. |

### `waniwani connect`

Two flavors of agents:

- **Managed** — WaniWani provisions a GitHub repo + Vercel project pre-wired with the [MCP distribution template](https://github.com/WaniWani-AI/mcp-distribution-template), API keys, and auto-deploys. Push to `main`, it deploys.
- **External** — You host the MCP server (Docker, Cloudflare Workers, your own infra). The CLI registers it with WaniWani and gives you a production API key to set as `WANIWANI_API_KEY`.

The CLI writes `orgId` and `projectId` to `waniwani.config.ts` so subsequent commands (and the SDK at runtime) pick them up automatically.

### `waniwani dev`

Spawns your local dev server (auto-detects `bun` / `pnpm` / `yarn` / `npm`), waits for it to bind to the port, creates a dev session against the WaniWani platform, and opens the playground with `localMode=1` so chat traffic routes to `localhost:3000` instead of your production deployment. Ctrl-C cleans everything up.

Override the port with `-p / --port <port>`, or set `devPort` in `waniwani.config.ts`.

## Configuration

The CLI is fully project-scoped — no global config.

### Auth & local state

Stored in `.waniwani/settings.json` (per repo, gitignored):

```json
{
  "apiUrl": "https://app.waniwani.ai",
  "accessToken": "…",
  "refreshToken": "…",
  "expiresAt": "2026-05-20T12:00:00Z",
  "clientId": "…"
}
```

Tokens auto-refresh on 401. Switch staging/production with `WANIWANI_API_URL`.

### Project config (`waniwani.config.ts`)

Shared with [`@waniwani/sdk`](https://www.npmjs.com/package/@waniwani/sdk). `waniwani connect` writes `orgId` and `projectId`; you can add anything else the SDK supports:

```ts
import type { WaniWaniProjectConfig } from "@waniwani/sdk";

export default {
  orgId: "org_…",
  projectId: "proj_…",
  devPort: 3000,
} satisfies WaniWaniProjectConfig;
```

### Env vars

| Variable | What it does |
|---|---|
| `WANIWANI_API_URL` | Override the API base URL (defaults to `https://app.waniwani.ai`). |
| `WANIWANI_API_KEY` | Use a long-lived API key instead of OAuth tokens. Useful in CI. |

### JSON output

Most commands support `--json` for scripting:

```bash
waniwani login --json
waniwani logout --json
```

`connect` and `dev` are interactive-only.

## For AI agents

If you're [Claude Code](https://claude.com/claude-code), Cursor, or another AI coding agent reading this, here's the short version:

1. `npm i -g @waniwani/cli` (or `bun add -g @waniwani/cli`)
2. `waniwani login`
3. `waniwani connect` — picks an org and an agent interactively; writes `waniwani.config.ts`
4. `waniwani dev` — runs the user's existing dev script, bridges it to the playground

The CLI assumes the user already has an MCP server in the cwd (or will scaffold one with [`@waniwani/sdk`](https://docs.waniwani.ai)). It does not generate code on its own — pair it with the SDK or the [MCP distribution template](https://github.com/WaniWani-AI/mcp-distribution-template).

For building the actual flow / tools / widgets, see the [SDK docs](https://docs.waniwani.ai) and install the [agent skill](https://docs.waniwani.ai/guides/skills):

```bash
bunx skills add WaniWani-AI/sdk -s waniwani-sdk
```

## Status

Pre-1.0. The command surface is small and stable (`login` / `logout` / `connect` / `dev`), but flags and output format may change without notice until v1. Pin your CLI version in CI.

## Links

- **Website:** [waniwani.ai](https://waniwani.ai)
- **Dashboard:** [app.waniwani.ai](https://app.waniwani.ai)
- **SDK:** [`@waniwani/sdk`](https://www.npmjs.com/package/@waniwani/sdk) · [docs.waniwani.ai](https://docs.waniwani.ai)
- **CLI reference:** [docs.waniwani.ai/cli/overview](https://docs.waniwani.ai/cli/overview)
- **Template:** [WaniWani-AI/mcp-distribution-template](https://github.com/WaniWani-AI/mcp-distribution-template)
- **Issues:** [github.com/WaniWani-AI/cli/issues](https://github.com/WaniWani-AI/cli/issues)

## License

[MIT](./LICENSE) © WaniWani

"WaniWani" is a trademark of WaniWani Inc. The license covers the code, not the name.
