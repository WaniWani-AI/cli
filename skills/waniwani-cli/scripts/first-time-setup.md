# First-Time Setup

Walkthrough for getting from zero to a local MCP connected to the WaniWani playground. Run from the user's MCP project directory.

## Step 1: Confirm the project shape

Before running any CLI commands, verify the user's project is set up to host an MCP HTTP server:

```bash
cat package.json | grep '"dev"'
```

Expect a `dev` script that starts an HTTP server (e.g. `next dev`, `bun run scripts/dev.ts`, `tsx server.ts`). If there's no `dev` script, the `waniwani dev` command later will fail — ask the user to add one before continuing.

Also check for an existing config:

```bash
ls .waniwani waniwani.config.ts 2>/dev/null
```

- Both exist → user has done this before. Skip to Step 4.
- Only `waniwani.config.ts` exists → likely committed without auth. Run Step 2 (login) only.
- Neither exists → fresh setup. Continue to Step 2.

## Step 2: Log in

```bash
bunx @waniwani/cli@latest login
```

What this does:

- Opens the user's browser to the WaniWani auth page.
- After they approve, stores OAuth tokens in `./.waniwani/settings.json`.
- Prints the active org name.

If the user is in a corporate environment where the browser can't open, pass `--no-browser` and they'll see the URL printed for manual paste:

```bash
bunx @waniwani/cli@latest login --no-browser
```

If `.waniwani/` is not already in `.gitignore`, add it:

```bash
echo ".waniwani/" >> .gitignore
```

## Step 3: Connect the project to a WaniWani agent

```bash
bunx @waniwani/cli@latest connect
```

What happens (interactive):

1. **Org pick** — if the user has only one org, it auto-selects. If multiple, prompts for choice.
2. **Project pick** — lists existing projects. Two extra options:
   - **+ Create new managed agent** — WaniWani provisions a GitHub repo + Vercel project. Use when the user wants WaniWani to host the MCP.
   - **+ Create new external agent** — User hosts the MCP themselves. Returns a production API key (shown once) for the hosted server's `WANIWANI_API_KEY`. Use this for projects already in the user's repo.
3. **Writes** `waniwani.config.ts` at the repo root with `orgId` and `projectId`. If the file exists, it merges into the default export; if it can't (unusual file shape), it prints a snippet for manual paste.

For an existing repo with an MCP server already in it, **external** is the right choice. Only suggest **managed** if the user wants WaniWani to scaffold and host a brand-new project.

After connect:

```bash
cat waniwani.config.ts
```

Verify `orgId` and `projectId` are present.

## Step 4: Run locally with the playground

```bash
bunx @waniwani/cli@latest dev
```

What happens:

- Detects the user's package manager from the lockfile.
- Spawns `bun/pnpm/yarn/npm run dev` with `PORT=3000` (or whatever's resolved).
- Waits up to 30s for `http://localhost:3000/` to respond.
- Registers a dev session with WaniWani.
- Opens the browser to `<apiUrl>/agents/<projectId>/playground?localMode=1`.

In the browser:

1. The local-mode modal opens automatically.
2. "Connection status" turns green within ~2s.
3. Click **Connect**.
4. Send a chat message — it routes to `http://localhost:3000` from the user's browser.

Press **Ctrl-C** in the terminal to stop. The dev session is deleted, and the playground falls back to the production environment.

## Step 5: Verify the loop works

Have the user:

1. Make a small change to their MCP code (e.g. add a `console.log` in a tool handler).
2. Trigger that tool from the playground chat.
3. Confirm the log appears in the terminal.

This confirms the round-trip — browser → localhost → MCP → response → browser.

## Common follow-ups

| User asks | Do |
|---|---|
| "Can I use a different port?" | `waniwani dev --port 3001`, or set `devPort: 3001` in `waniwani.config.ts` |
| "Why does Safari not work?" | Browser security limit on `https → http://localhost`. Use Chrome/Firefox. See [references/dev.md](../references/dev.md). |
| "How do I deploy this?" | The CLI doesn't deploy. Managed agents auto-deploy on push (Vercel hook). External agents deploy with their own infra. |
| "Can I switch to staging?" | `waniwani logout && export WANIWANI_API_URL=https://dev.waniwani.ai && waniwani login`. See [references/configuration.md](../references/configuration.md). |
| "Can my teammate run this on the same project?" | Yes — each teammate runs `waniwani login` in their own checkout. Dev sessions are scoped per `(user, project)`. Multiple teammates running `waniwani dev` against the same project don't conflict. |

## When to break out of the playbook

- **The user already has `WANIWANI_API_KEY` in their env** (e.g. CI or hosted server context). Skip `waniwani login` entirely — API key auth bypasses OAuth. Their `waniwani.config.ts` may not need `orgId`/`projectId` either if they only call SDK code, not the CLI.
- **The user only wants to run their MCP locally without the playground**. The CLI isn't needed at all — they just `bun run dev` directly. `waniwani dev` exists specifically for the playground integration.
- **The user is building a managed agent from scratch**. Direct them to the SDK's `initialize` playbook (in the `@waniwani/sdk` skill) for scaffolding the project itself; the CLI commands here are about linking an existing project, not creating one.
