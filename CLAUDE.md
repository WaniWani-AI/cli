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
│   ├── auth.ts         # Token management
│   ├── config.ts       # Global config (~/.waniwani/config.json)
│   ├── project-config.ts # Project config (.waniwani.json)
│   ├── errors.ts       # Error handling
│   └── output.ts       # Output formatting
└── types/              # TypeScript types
    └── index.ts
```

## Configuration

### API URL Priority

The API URL is resolved with this priority:

1. **Environment variable**: `WANIWANI_API_URL`
2. **Config file**: `~/.waniwani/config.json` → `apiUrl`
3. **Default**: `https://app.waniwani.ai`

Use `config.getApiUrl()` to get the resolved URL.

### Config Files

- **Global config**: `~/.waniwani/config.json` - User preferences, active MCP, API URL
- **Auth store**: `~/.waniwani/auth.json` - OAuth tokens (access, refresh, expiry)
- **Project config**: `.waniwani.json` - Per-project settings (MCP ID, defaults)

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
