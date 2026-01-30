---
name: waniwani
description: Create and manage MCP servers with local development workflow. Use when the user needs to develop MCP servers, manage sandbox files, or deploy to GitHub and Vercel.
allowed-tools: Bash(waniwani:*), Write, Read, Glob
---

# MCP Development with WaniWani CLI

## Quick Start

```bash
waniwani login                # Authenticate with WaniWani
waniwani init my-mcp          # Create sandbox + download template locally
cd my-mcp
waniwani push                 # Sync files to sandbox
waniwani mcp start            # Start the server
waniwani mcp logs -f          # Stream server logs
```

## Limitations

- **Sandboxes are for MCP servers** - The preview URL serves MCP protocol (SSE), not HTTP. Don't use for static sites or regular web apps.
- **No persistent storage** - Sandboxes expire after ~30 minutes of inactivity.

## Core Workflow

1. **Login**: `waniwani login` (OAuth2 flow opens browser)
2. **Initialize**: `waniwani init <name>` (creates sandbox + downloads template locally)
3. **Develop locally**: Edit files with full IDE support, autocomplete, linting
4. **Push changes**: `waniwani push` to sync local files to sandbox
5. **Start server**: `waniwani mcp start` (runs in background)
6. **Monitor logs**: `waniwani mcp logs -f` (stream server output)
7. **Deploy**: `waniwani mcp deploy` when ready for production

## Commands

### Authentication

```bash
waniwani login                  # Login via browser OAuth2 flow
waniwani login --no-browser     # Get URL without opening browser
waniwani logout                 # Clear stored credentials
```

### Initialize Project

```bash
waniwani init <name>            # Create sandbox + download template to ./<name>/
```

This command:
1. Creates a cloud sandbox with the MCP template pre-loaded
2. Downloads all template files from the sandbox to a local `./<name>/` directory
3. Links the local project to the sandbox via `.waniwani/settings.json`

No GitHub access required - the template is served directly from the sandbox.

### Sync & Development

```bash
waniwani push                   # Sync local files to sandbox
waniwani push --dry-run         # Show what would be synced without uploading
waniwani dev                    # Watch mode - auto-sync on file change
waniwani dev --no-initial-sync  # Skip initial sync, just watch for changes
```

### MCP Sandbox Management

```bash
waniwani mcp list               # List all active MCPs
waniwani mcp list --all         # Include stopped/expired MCPs
waniwani mcp use <name>         # Select an MCP for subsequent commands
waniwani mcp use <name> --global    # Save to global config
waniwani mcp status             # Show current MCP status and server info
waniwani mcp delete             # Delete sandbox and clear from config
```

### MCP Server Lifecycle

Start, stop, and monitor your MCP server running in the sandbox.

```bash
waniwani mcp start                  # Start MCP server (npm run dev) in background
waniwani mcp start --command "node src/index.js"  # Custom start command
waniwani mcp stop                   # Stop the running MCP server
waniwani mcp logs                   # Get current logs from the running server
waniwani mcp logs -f                # Stream logs continuously (follow mode)
waniwani mcp logs --follow          # Same as -f
```

**Typical workflow:**
```bash
waniwani init my-server         # Initialize project
cd my-server
# ... edit files locally ...
waniwani push                   # Sync changes
waniwani mcp start              # Start the server
waniwani mcp logs -f            # Monitor output (Ctrl+C to exit)
# Make more changes locally...
waniwani push                   # Push new changes
waniwani mcp stop               # Stop server
waniwani mcp start              # Restart with changes
```

### Deployment

```bash
waniwani mcp deploy                         # Deploy with defaults
waniwani mcp deploy --repo my-mcp           # Specify repo name
waniwani mcp deploy --org my-org            # Specify GitHub org
waniwani mcp deploy --private               # Create private repo
```

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

| File | Purpose |
|------|---------|
| `~/.waniwani/settings.json` | Global user preferences, active MCP |
| `~/.waniwani/auth.json` | OAuth tokens (access, refresh, expiry) |
| `.waniwani/settings.json` | Per-project settings (sandbox ID) |

## Local Project Structure

After `waniwani init my-mcp`:

```
my-mcp/
├── .waniwani/
│   └── settings.json         # Sandbox ID (auto-generated)
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

Projects are initialized with a **pre-configured MCP template** based on Next.js 15, ready for ChatGPT integration. The template is automatically loaded into the sandbox and downloaded to your local machine during `waniwani init` - no separate GitHub access required.

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
Sandboxes expire after ~30 minutes of inactivity. The sandbox will auto-resume when you run commands:
```bash
waniwani push       # Will resume sandbox if expired
waniwani mcp start  # Will resume sandbox if expired
```

### Changes not reflected
Make sure you've pushed your changes:
```bash
waniwani push
```
Or use watch mode for automatic syncing:
```bash
waniwani dev
```
