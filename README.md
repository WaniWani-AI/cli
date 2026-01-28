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

# Create an MCP sandbox
waniwani mcp create my-server

# Send tasks to Claude
waniwani task "Add a weather tool"

# Test your tools
waniwani mcp test

# Deploy to GitHub + Vercel
waniwani mcp deploy
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate with WaniWani |
| `logout` | Clear local credentials |
| `mcp create <name>` | Create a new MCP sandbox |
| `mcp list` | List your MCPs |
| `mcp use <name>` | Select active MCP |
| `mcp status` | Show current MCP status |
| `mcp test [tool]` | Test MCP tools |
| `mcp deploy` | Deploy to GitHub + Vercel |
| `mcp stop` | Stop and cleanup sandbox |
| `task <prompt>` | Send task to Claude |
| `org list` | List organizations |
| `org switch` | Switch organization |

## Configuration

The CLI stores auth tokens and settings in `~/.waniwani/`.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WANIWANI_API_URL` | API base URL | `https://app.waniwani.ai` |

To connect to a different environment (e.g., self-hosted):

```bash
WANIWANI_API_URL=https://another-waniwani-domain.ai waniwani login
```

Or export it for the session:

```bash
export WANIWANI_API_URL=https://staging.waniwani.com
waniwani login
waniwani mcp list
```

## License

MIT
