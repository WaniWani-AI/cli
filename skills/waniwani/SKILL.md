---
name: waniwani
description: Create and manage MCP server sandboxes, read/write files, run commands, and deploy to production. Use when the user needs to develop MCP servers, manage sandbox files, or deploy to GitHub and Vercel.
allowed-tools: Bash(waniwani:*)
---

# MCP Development with WaniWani CLI

## Quick start

```bash
waniwani login                          # Authenticate with WaniWani
waniwani mcp create my-server           # Create a new MCP sandbox
waniwani mcp file write src/index.ts --file ./local.ts  # Upload file
waniwani mcp run-command npm install    # Run commands in sandbox
waniwani mcp deploy                     # Deploy to GitHub + Vercel
```

## Limitations

- **Sandboxes are for MCP servers** - The preview URL serves MCP protocol (SSE), not HTTP. Don't use for static sites or regular web apps.
- **No persistent storage** - Sandboxes expire after ~30 minutes of inactivity.

## Core workflow

1. **Login**: `waniwani login` (OAuth2 flow opens browser)
2. **Create sandbox**: `waniwani mcp create <name>`
3. **Write code**: Use `waniwani mcp file write` to push files to sandbox
4. **Install deps**: `waniwani mcp run-command npm install`
5. **Start server**: `waniwani mcp start` (runs in background)
6. **Monitor logs**: `waniwani mcp logs -f` (stream server output)
7. **Deploy**: `waniwani mcp deploy`

## Commands

### Authentication

```bash
waniwani login                  # Login via browser OAuth2 flow
waniwani login --no-browser     # Get URL without opening browser
waniwani logout                 # Clear stored credentials
```

### MCP Sandbox Management

```bash
waniwani mcp create <name>      # Create a new MCP sandbox
waniwani mcp create <name> --global  # Save to global config
waniwani mcp list               # List all active MCPs
waniwani mcp list --all         # Include stopped/expired MCPs
waniwani mcp use <name>         # Select an MCP for subsequent commands
waniwani mcp use <name> --global    # Save to global config
waniwani mcp status             # Show current MCP status and server info
waniwani mcp status --mcp-id <id>   # Status for specific MCP
waniwani mcp stop               # Stop the running MCP server
waniwani mcp stop --mcp-id <id>     # Stop server for specific sandbox
waniwani mcp delete             # Delete sandbox and clear from config
waniwani mcp delete --mcp-id <id>   # Delete specific sandbox
```

### File Operations

All paths are relative to the project root. Leading slashes are optional.

```bash
# List files
waniwani mcp file list                  # List project root
waniwani mcp file list src              # List specific directory

# Read files from sandbox
waniwani mcp file read src/index.ts     # Print to stdout
waniwani mcp file read src/index.ts --output local.ts  # Save locally

# Write files to sandbox
waniwani mcp file write src/new.ts --content "export const foo = 1;"
waniwani mcp file write src/new.ts --file ./local-file.ts
```

### Run Commands in Sandbox

Commands run in the project root by default.

```bash
waniwani mcp run-command npm install        # Install dependencies
waniwani mcp run-command npm run build      # Build the project
waniwani mcp run-command "ls -la"           # Quote commands with flags
waniwani mcp run-command --cwd src ls       # Set working directory
waniwani mcp run-command --timeout 60000 npm run build  # Custom timeout (ms)
waniwani mcp run-command --stream npm install  # Stream output in real-time
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
waniwani mcp logs <cmdId>           # Get logs from a specific command
waniwani mcp logs <cmdId> -f        # Stream logs from a specific command
```

**Typical workflow:**
```bash
waniwani mcp create my-server       # Create sandbox
# ... write files, npm install ...
waniwani mcp start                  # Start the server
waniwani mcp logs -f                # Monitor output (Ctrl+C to exit)
# Make changes to files...
waniwani mcp stop                   # Stop server
waniwani mcp start                  # Restart with changes
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
| `~/.waniwani/config.json` | Global user preferences, active MCP |
| `~/.waniwani/auth.json` | OAuth tokens (access, refresh, expiry) |
| `.waniwani/settings.local.json` | Per-project settings |

## Sandbox File System

```
/                       # Project root (all paths relative to here)
├── src/                # Source code
│   └── index.ts        # Main entry point
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
└── node_modules/       # Installed packages
```

## Templates

### Basic MCP Server

Use this to bootstrap a new MCP server with one tool.

**1. Create sandbox:**
```bash
waniwani mcp create my-server
```

**2. Write package.json:**
```bash
waniwani mcp file write package.json --content '{
  "name": "my-mcp",
  "type": "module",
  "scripts": { "dev": "tsx src/index.ts" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}'
```

**3. Write src/index.ts:**
```bash
waniwani mcp file write src/index.ts --content 'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "my-mcp", version: "1.0.0" });

server.tool("hello", "Says hello", {
  name: { type: "string", description: "Name to greet" }
}, async ({ name }) => ({
  content: [{ type: "text", text: `Hello, ${name}!` }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);'
```

**4. Install:**
```bash
waniwani mcp run-command npm install
```

## Troubleshooting

### Preview URL shows blank page
The sandbox serves MCP protocol (SSE), not HTTP. The preview URL is for MCP clients to connect, not for browsers. This is expected behavior.

### Commands with pipes or flags don't work
Quote the entire command:
```bash
waniwani mcp run-command "ls -la"
waniwani mcp run-command "cat file.txt | head -5"  # Note: pipes may still fail
```

### Sandbox expired
Sandboxes expire after ~30 minutes of inactivity. Create a new one:
```bash
waniwani mcp create my-server
```
