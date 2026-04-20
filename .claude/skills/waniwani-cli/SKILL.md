---
name: waniwani-cli
description: WaniWani CLI overview - authentication, configuration, and global options. Use when the user needs to log in, configure the CLI, or understand the overall CLI structure.
allowed-tools: Bash(waniwani:*), Write, Read, Glob
---

# WaniWani CLI

## Quick Start

```bash
waniwani login                  # Authenticate with WaniWani
waniwani mcp create my-mcp      # Create project and clone locally
cd my-mcp
waniwani mcp preview            # Start sandbox, sync files, start server, watch for changes
```

## Authentication

```bash
waniwani login                  # Login via browser OAuth2 PKCE flow
waniwani login --no-browser     # Get URL without opening browser
waniwani logout                 # Clear stored credentials
```

- `waniwani login` creates `.waniwani/` in the current directory if needed
- `waniwani mcp create` copies parent `.waniwani/` to new project (including auth tokens)

### Auth Priority

1. `WANIWANI_API_KEY` environment variable
2. `waniwani.config.ts` `apiKey` field
3. OAuth tokens from `.waniwani/settings.json`

## Configuration

### `.waniwani/settings.json` (per-project, no global config)

```bash
waniwani config init            # Initialize .waniwani config in current directory
waniwani config init --force    # Overwrite existing config
```

| Field | Purpose |
|-------|---------|
| `mcpId` | Selected MCP ID |
| `sessionId` | Current dev session ID |
| `apiUrl` | API base URL |
| `accessToken` | OAuth access token |
| `refreshToken` | OAuth refresh token |
| `expiresAt` | Token expiry (ISO 8601) |
| `clientId` | OAuth client ID |

### `waniwani.config.ts` (optional, shared with @waniwani/sdk)

| Field | Purpose |
|-------|---------|
| `apiKey` | API key for authentication |
| `apiUrl` | API base URL |
| `evals` | Eval configuration |

### API URL Priority

1. `WANIWANI_API_URL` environment variable
2. `waniwani.config.ts` `apiUrl` field
3. `.waniwani/settings.json` `apiUrl` field
4. Default: `https://app.waniwani.ai`

## Global Options

```bash
waniwani --json <command>           # Output results as JSON
waniwani --verbose <command>        # Enable verbose logging
```

## Sub-Skills

Detailed command documentation lives in dedicated sub-skills:

- **`mcp/`** — MCP lifecycle, development, and deployment (create, preview, deploy, logs, etc.)
- **`mcp/file/`** — Sandbox file operations
- **`org/`** — Organization management (list, switch)
