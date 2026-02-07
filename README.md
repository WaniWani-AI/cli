# @waniwani/cli

CLI for [app.waniwani.ai](https://app.waniwani.ai) - MCP development workflow.

## Warning

This is **pre-alpha** software. Here's what that means:

- Everything will break
- APIs will change without notice
- Commands will be renamed, removed, or completely redesigned
- Your config files might get nuked
- We will not apologize

If you're not comfortable with that, wait for v1.0. If you open an issue complaining about breaking changes during pre-alpha, we will close it.

## What is WaniWani?

[WaniWani](https://app.waniwani.ai) is the Shopify of MCP servers — enabling quote-based businesses that sell complex services to deploy AI agents that capture leads, qualify customers, and generate quotes.

This CLI is how you interact with WaniWani from your terminal.

## Installation

```bash
# npm
npm install -g @waniwani/cli

# pnpm
pnpm add -g @waniwani/cli

# yarn
yarn global add @waniwani/cli

# bun
bun add -g @waniwani/cli
```

Requires Node.js 20 or later.

## Usage

```bash
# Authenticate
waniwani login

# Create an MCP project
waniwani mcp create my-server

# Send tasks to Claude
waniwani task "Add a weather tool"

# Test your tools
waniwani mcp test

# Deploy to GitHub + Vercel
waniwani mcp publish
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate with WaniWani |
| `logout` | Clear local credentials |
| `mcp create <name>` | Create a new MCP project |
| `mcp clone <name>` | Clone an existing MCP locally |
| `mcp list` | List your MCPs |
| `mcp use <name>` | Select active MCP |
| `mcp status` | Show current MCP status |
| `mcp test [tool]` | Test MCP tools |
| `mcp publish` | Publish to GitHub + Vercel |
| `mcp stop` | Stop and cleanup sandbox |
| `task <prompt>` | Send task to Claude |
| `org list` | List organizations |
| `org switch` | Switch organization |

## Configuration

The CLI stores auth tokens and settings in `~/.waniwani/`.

### API URL

The API URL can be configured in three ways (in order of priority):

1. **Environment variable**: `WANIWANI_API_URL`
2. **Config file**: `~/.waniwani/config.json` → `apiUrl`
3. **Default**: `https://app.waniwani.ai`

#### Using environment variable

```bash
WANIWANI_API_URL=https://staging.waniwani.ai waniwani login
```

#### Using config file

Edit `~/.waniwani/config.json`:

```json
{
  "apiUrl": "https://staging.waniwani.ai"
}
```

## License

MIT
