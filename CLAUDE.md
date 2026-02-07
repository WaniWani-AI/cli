# WaniWani CLI

CLI for [app.waniwani.ai](https://app.waniwani.ai) - MCP development workflow.

## Project Structure

```
src/
├── cli.ts              # CLI entry point, command registration
├── index.ts            # Package exports
├── commands/           # Command implementations
│   ├── login.ts        # OAuth2 PKCE login flow
│   ├── logout.ts       # Clear credentials
│   ├── init.ts         # Project initialization
│   ├── task.ts         # Send tasks to Claude
│   ├── mcp/            # MCP subcommands
│   │   ├── create.ts   # Create MCP sandbox
│   │   ├── list.ts     # List MCPs
│   │   ├── use.ts      # Select active MCP
│   │   ├── status.ts   # Show MCP status
│   │   ├── test.ts     # Test MCP tools
│   │   ├── deploy.ts   # Deploy to GitHub + Vercel
│   │   └── stop.ts     # Stop sandbox
│   └── org/            # Organization subcommands
│       ├── list.ts     # List organizations
│       └── switch.ts   # Switch organization
├── lib/                # Shared utilities
│   ├── api.ts          # API client with auth
│   ├── auth.ts         # Token management (delegates to config)
│   ├── config.ts       # Local config (.waniwani/settings.json)
│   ├── errors.ts       # Error handling
│   └── output.ts       # Output formatting
└── types/              # TypeScript types
    └── index.ts
```

## Configuration

All config is stored locally in `.waniwani/settings.json` (per-project, no global config).

### Config Schema

```json
{
  "sessionId": "...",      // Current dev session ID
  "mcpId": "...",          // Selected MCP ID
  "apiUrl": "...",         // API base URL
  "accessToken": "...",    // OAuth access token
  "refreshToken": "...",   // OAuth refresh token
  "expiresAt": "...",      // Token expiry (ISO 8601)
  "clientId": "..."        // OAuth client ID
}
```

### API URL Priority

1. **Environment variable**: `WANIWANI_API_URL`
2. **Config file**: `.waniwani/settings.json` → `apiUrl`
3. **Default**: `https://app.waniwani.ai`

### Auth Flow

- `waniwani login` creates `.waniwani/` in current directory if needed
- `waniwani mcp create` copies parent `.waniwani/` to new project (including auth)

## Key Patterns

### API Requests

Use `api.get()`, `api.post()`, `api.delete()` from `src/lib/api.ts`. Auth headers are added automatically.

### Error Handling

Throw `CLIError` or `AuthError` from `src/lib/errors.ts`. Use `handleError()` for consistent output.

### Output

Use `formatOutput()` for JSON mode support, `formatSuccess()`/`formatError()` for styled messages.

## Commands

**Important**: Only use `bun` for this project.

Build: `bun run build`
Dev: `bun run dev`
Test: `bun run test`
Lint: `bun run lint`
