---
name: mcp
description: MCP server lifecycle management - create, clone, develop, preview, deploy, and manage MCP servers. Use when the user needs to create, develop, or manage MCP environments.
allowed-tools: Bash(waniwani:*), Write, Read, Glob
---

# MCP Server Lifecycle Management

## Create & Clone

### `waniwani mcp create <name>`
Create a new MCP project. This creates a GitHub repo, clones it locally, and configures the git credential helper.

### `waniwani mcp clone <name> [directory]`
Clone an existing MCP to a local directory.
- `[directory]` - Target directory (defaults to the MCP name)

## Development

### `waniwani mcp preview`
Start live development with sandbox, server, and file watcher.

Options:
- `--mcp-id <id>` - Use a specific MCP ID
- `--no-watch` - Skip file watching
- `--no-logs` - Don't stream logs
- `--status-poll-interval-ms <ms>` - Watch-mode server status polling interval (default: 60000)

What preview does:
1. Creates or resumes a sandbox
2. Syncs local files to the sandbox
3. Starts the server
4. Watches for local file changes and syncs them automatically

**Important**: The preview URL is MCP protocol (SSE), NOT HTTP. Do not open it in a browser.

## MCP Selection & Status

### `waniwani mcp list`
List all MCPs in the current organization.

### `waniwani mcp use <name>`
Select an MCP for subsequent commands.

### `waniwani mcp status`
Show the current MCP status.

Options:
- `--mcp-id <id>` - Query a specific MCP ID

## Server Management

### `waniwani mcp stop`
Stop the development environment (sandbox + server).

Options:
- `--mcp-id <id>`

### `waniwani mcp logs [cmdId]`
Stream logs from the server.

- `[cmdId]` - Command ID (defaults to the currently running server)

Options:
- `--mcp-id <id>`
- `-f, --follow` - Keep streaming (default: true)
- `--no-follow` - Fetch logs and exit

### `waniwani mcp run-command <command> [args...]`
Run a command in the sandbox.

Options:
- `--mcp-id <id>`
- `--cwd <path>` - Working directory inside the sandbox
- `--timeout <ms>` - Timeout in milliseconds (default: 30000, max: 300000)

## Sync & Deploy

### `waniwani mcp sync`
Pull template files to the local project.

Options:
- `--mcp-id <id>`

### Deployment
Deployment happens via git push. Vercel auto-deploys via webhook:
```bash
git push origin main
```

## Delete

### `waniwani mcp delete`
Delete an MCP and all associated resources.

Options:
- `--mcp-id <id>`
- `--force` - Skip the confirmation prompt

## Testing

After running `preview`, test with MCP Inspector:
```bash
npx @anthropic-ai/mcp-inspector@latest "<preview-url>/mcp"
```

## Typical Workflow

```bash
waniwani mcp create my-server
cd my-server
waniwani mcp preview
# edit files locally (auto-synced to sandbox)
# Ctrl+C to stop preview
git add . && git commit -m "Add new tool"
git push origin main
```

## Local Project Structure

After `waniwani mcp create my-mcp`:
```
my-mcp/
├── .waniwani/settings.json
├── app/mcp/route.ts
├── lib/{{MCP_NAME}}/tools/
├── lib/{{MCP_NAME}}/widgets/
├── package.json
└── CLAUDE.md
```

## Troubleshooting

- **Preview URL shows a blank page** - This is expected. The preview URL serves MCP protocol (SSE), not HTTP content. Use MCP Inspector to interact with it.
- **Sandbox expired** - Run `waniwani mcp preview` again to create a fresh sandbox.
- **Changes not syncing** - Restart preview (`Ctrl+C` then `waniwani mcp preview`).
- **Changes not deployed** - Verify the git push succeeded with `git push origin main`.

## Limitations

- Sandboxes are for MCP servers only (not static sites or web apps).
- No persistent storage - sandboxes expire after approximately 30 minutes of inactivity.
