---
name: waniwani
description: Create and manage MCP servers with local development workflow. Use when the user needs to develop MCP servers, manage sandbox files, or deploy to GitHub and Vercel.
allowed-tools: Bash(waniwani:*), Write, Read, Glob
---

# MCP Development with WaniWani CLI

## Quick Start

```bash
waniwani login                # Authenticate with WaniWani
waniwani mcp init my-mcp      # Create GitHub repo and local project
cd my-mcp
waniwani mcp sync             # Pull template files
waniwani mcp dev              # Start sandbox, sync files, start server, watch for changes
```

## Limitations

- **Sandboxes are for MCP servers** - The preview URL serves MCP protocol (SSE), not HTTP. Don't use for static sites or regular web apps.
- **No persistent storage** - Sandboxes expire after ~30 minutes of inactivity.

## Core Workflow

1. **Login**: `waniwani login` (OAuth2 flow opens browser)
2. **Initialize**: `waniwani mcp init <name>` (creates GitHub repo and local project directory)
3. **Sync**: `waniwani mcp sync` (pulls template files from GitHub)
4. **Develop**: `waniwani mcp dev` (starts sandbox + server + file watcher all in one)
5. **Edit locally**: Make changes with full IDE support, files auto-sync to sandbox
6. **Deploy**: `waniwani mcp deploy` to push files to GitHub for production

## Commands

### Authentication

```bash
waniwani login                  # Login via browser OAuth2 flow
waniwani login --no-browser     # Get URL without opening browser
waniwani logout                 # Clear stored credentials
```

### Initialize Project

```bash
waniwani mcp init <name>        # Create GitHub repo and local project directory
```

This command:
1. Creates a GitHub repository with the MCP template
2. Creates a local `./<name>/` directory
3. Links the local project to the MCP via `.waniwani/settings.json`

Run `waniwani mcp sync` after to pull the template files.

### Development

```bash
waniwani mcp dev                # Start sandbox + server + file watcher
waniwani mcp dev --no-watch     # Start without file watching
waniwani mcp dev --no-logs      # Don't stream logs to terminal
waniwani mcp dev --mcp-id <id>  # Use specific MCP ID
```

The `dev` command handles everything:
1. Creates or resumes the sandbox
2. Syncs all local files to the sandbox
3. Starts the MCP server
4. Watches for file changes and auto-syncs them

### MCP Management

```bash
waniwani mcp list               # List all MCPs
waniwani mcp list --all         # Include stopped/expired MCPs
waniwani mcp use <name>         # Select an MCP for subsequent commands
waniwani mcp status             # Show current MCP status and server info
waniwani mcp delete             # Delete MCP from cloud
```

### Server & Logs

```bash
waniwani mcp stop               # Stop the running MCP server
waniwani mcp logs               # Get current logs from the running server
waniwani mcp logs -f            # Stream logs continuously (follow mode)
waniwani mcp logs --follow      # Same as -f
```

**Typical workflow:**
```bash
waniwani mcp init my-server     # Create repo and local project
cd my-server
waniwani mcp sync               # Pull template files
waniwani mcp dev                # Start sandbox + server + file watcher
# ... edit files locally (auto-synced) ...
# Ctrl+C to stop
waniwani mcp deploy             # Push files to GitHub and deploy
```

### Testing with MCP Inspector

After starting the server, `waniwani mcp dev` displays an MCP Inspector command you can run to test your tools interactively:

```bash
npx @anthropic-ai/mcp-inspector@latest "<preview-url>/mcp"
```

The inspector provides a web UI to:
- List all available tools
- Call tools with custom inputs
- View tool responses

### Deployment & Sync

```bash
waniwani mcp deploy -m "message"    # Push local files to GitHub with commit message
waniwani mcp deploy                 # Prompts for commit message interactively
waniwani mcp sync                   # Pull files from GitHub to local project
```

The `deploy` command:
1. Collects all local files (respects .gitignore)
2. Pushes them to the WaniWani GitHub repository with the provided commit message
3. Deployment starts automatically via webhook

### Organization Management

```bash
waniwani org list                   # List your organizations
waniwani org switch <name>          # Switch to different org
```

## Global Options

```bash
waniwani --json <command>           # Output results as JSON
waniwani --verbose <command>        # Enable verbose logging
```

## Configuration

All config is stored locally in `.waniwani/settings.json` (no global config).

### Config File

| Field | Purpose |
|-------|---------|
| `mcpId` | Selected MCP ID |
| `sessionId` | Current dev session ID |
| `apiUrl` | API base URL |
| `accessToken` | OAuth access token |
| `refreshToken` | OAuth refresh token |
| `expiresAt` | Token expiry (ISO 8601) |
| `clientId` | OAuth client ID |

### Auth Flow

- `waniwani login` creates `.waniwani/` in current directory if needed
- `waniwani mcp init` copies parent `.waniwani/` to new project (including auth tokens)

## Local Project Structure

After `waniwani mcp init my-mcp && cd my-mcp && waniwani mcp sync`:

```
my-mcp/
├── .waniwani/
│   └── settings.json         # MCP ID + auth tokens (auto-generated)
├── app/
│   ├── mcp/route.ts          # Register tools & widgets here
│   └── ({{MCP_NAME}})/       # Widget pages
├── lib/
│   └── {{MCP_NAME}}/
│       ├── tools/            # Your tool implementations
│       └── widgets/          # Your widget definitions
├── package.json
└── CLAUDE.md                 # MCP development guide
```

## MCP Template

Projects are initialized with a **pre-configured MCP template** based on Next.js 15, ready for ChatGPT integration. The template is pulled from GitHub via `waniwani mcp sync`.

The template includes tools, widgets, and all framework utilities.

**See the template's CLAUDE.md for:**
- Project structure and code boundaries
- How to create tools using `createTool()`
- How to create widgets with UI that renders in ChatGPT
- Available React hooks for ChatGPT integration
- Deployment instructions

## Troubleshooting

### Preview URL shows blank page
The sandbox serves MCP protocol (SSE), not HTTP. The preview URL is for MCP clients to connect, not for browsers. This is expected behavior.

### Sandbox expired
Sandboxes expire after ~30 minutes of inactivity. Simply run `waniwani mcp dev` again to resume:
```bash
waniwani mcp dev    # Will create/resume sandbox automatically
```

### Changes not reflected in sandbox
If you're using `waniwani mcp dev`, changes should auto-sync. If not, restart the dev command:
```bash
# Ctrl+C to stop current session
waniwani mcp dev    # Restart with fresh sync
```

### Changes not deployed to production
Make sure you've pushed your changes to GitHub:
```bash
waniwani mcp deploy
```
