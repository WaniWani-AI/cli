# `waniwani dev` — Local Mode

Run your MCP locally and have the WaniWani playground talk to it directly from your browser. No tunnel, no manual URL pasting, no copy of the dashboard. Modeled after Upstash's QStash local mode.

## Usage

```bash
waniwani dev [--port <port>]
```

Run it from your MCP project directory (the one with `package.json` and `waniwani.config.ts`).

## What it does

1. **Auth check.** Errors out if not logged in.
2. **Bootstrap config.** If `waniwani.config.ts` is missing or has no `projectId`, runs the `connect` flow inline (org pick → project pick → writes the file).
3. **Resolves the port.** Precedence: `--port` flag > `devPort` in `waniwani.config.ts` > `3000`.
4. **Detects your package manager** from your lockfile (`bun.lock`/`bun.lockb` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm).
5. **Spawns your dev script** as `<pm> run dev` (e.g. `bun run dev`) with `PORT=<port>` in the environment. Stdio is inherited so you see your MCP's logs.
6. **Polls** `http://localhost:<port>/` until any HTTP response comes back, with a 30s timeout.
7. **Registers a "dev session"** with the WaniWani backend (`POST /api/mcp/projects/<id>/dev-session`), keyed to your user + project.
8. **Heartbeats** that session every 30s while running.
9. **Opens the playground** at `<apiUrl>/agents/<projectId>/playground?localMode=1` in your default browser. The query param auto-opens the local-mode modal.
10. **Cleans up on Ctrl-C**: stops heartbeating, DELETEs the session, kills the spawned MCP process, exits.

## What you see in the playground

The playground modal mirrors Upstash:

- **Step 1: Run the dev command** — `bunx @waniwani/cli@latest dev` with a copy button.
- **Step 2: Connection status** — polls every 2s. Shows "Waiting for your local server..." (spinner) until your dev session lands, then "Connected to http://localhost:3000" (green check).
- **Step 3: Browser note** — "Local mode dispatches requests from the browser to http://localhost. Safari blocks this by default — use Chrome or Firefox for local mode."
- Click **Connect** → playground swaps its MCP target to `http://localhost:<port>` for the rest of the session, and chat calls fire from your browser to your local server.

When the modal shows "Connected", click Connect. The header replaces the environment selector with a "Local: localhost:3000" pill. Clicking the pill disconnects and restores the env selector.

## Why no tunnel

Your browser (running the playground) is on the same machine as your MCP server. Browsers can reach `localhost` directly. A tunnel would only matter if a server (e.g. ChatGPT, Claude Desktop) needed to call your MCP — and for those clients, you still want `cloudflared` or `ngrok`.

## Requirements

Your MCP project needs:

- A `dev` script in `package.json` that starts an HTTP server.
- The dev script must respect `PORT=<port>` from the environment (Next.js does this by default; custom servers may not — check your code).
- CORS preflight handling for `https://app.waniwani.ai` on your `/api/waniwani/*` routes. The latest `@waniwani/sdk` handles this automatically. If you're on an older SDK and getting CORS errors, upgrade.

## Browser support

| Browser | Status |
|---|---|
| Chrome | Works |
| Firefox | Works |
| Safari | Blocks `https → http://localhost` requests by default |
| Edge | Works (Chromium) |

This is a browser security limitation, not something the CLI can work around. Use Chrome or Firefox for local mode. Same constraint applies to Upstash and any browser-based "local mode".

## Flags

| Flag | Default | Description |
|---|---|---|
| `-p, --port <port>` | `3000` (or `devPort` from config) | Port the MCP listens on. Validated as 1–65535. |

`waniwani dev` does **not** accept `--json` — it's interactive and runs until Ctrl-C.

## Config

Set `devPort` in `waniwani.config.ts` to skip the `--port` flag:

```ts
export default {
  orgId: "org_...",
  projectId: "proj_...",
  devPort: 3001,
};
```

## When things go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `Local server did not respond on http://localhost:3000 within 30s` | Your dev script doesn't honor `PORT`, or it's binding to a different port | Make the script honor `PORT`, or pass `--port <actual>` |
| Spinner succeeds, but POST 404s | Backend `dev_sessions` endpoint not deployed yet | Wait for the app deploy, or check `WANIWANI_API_URL` is correct |
| Playground modal stays "Waiting..." after connection succeeds | Heartbeat 401s on auth refresh failure | `waniwani logout && waniwani login` then re-run |
| Browser opens but local mode modal isn't visible | Ad-blocker / browser settings stripping the `?localMode=1` query | Add it manually in the URL bar |
| MCP process keeps running after Ctrl-C | Cascading children (e.g. Next.js spawning workers) | `lsof -i :3000` and `kill` the lingering process. Future versions may add tree-kill. |
| `Failed to start bun: ENOENT` | Wrong package manager detected, or PM not installed | Check your lockfile is the one you expect |

## Cross-repo dependencies

`waniwani dev` is one of three pieces. The other two live in the app and SDK repos:

- **App backend**: `dev_sessions` table + four REST endpoints. The CLI's POST/PATCH/DELETE/GET hit `/api/mcp/projects/:id/dev-session/...`.
- **App playground**: the local-mode modal + `?localMode=1` deeplink handler.
- **SDK**: OPTIONS preflight handling on `/api/waniwani/*` route handlers (chat, tool, tools, resource).

If the playground says "Waiting" forever after the CLI succeeded, one of those is missing or stale. The CLI side is purely a thin client — it doesn't store local state about whether the playground is configured correctly.

## Architecture deep-dive

For the full design (data model, API contract, security considerations, validation checklist), see [`docs/local-dev-mode.md`](../../../docs/local-dev-mode.md) at the CLI repo root. That doc is the source of truth for what the cross-repo pieces have to do.
