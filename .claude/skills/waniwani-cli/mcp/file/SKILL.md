---
name: mcp-file
description: MCP sandbox file operations - read, write, and list files in the remote sandbox. Use when the user needs to interact with files in the MCP sandbox directly.
allowed-tools: Bash(waniwani:*), Read, Glob
---

# MCP Sandbox File Operations

These commands operate on files in the **remote MCP sandbox**, not local files.

## Commands

### Read File

```
waniwani mcp file read <path>
```

Read a file from the MCP sandbox.

| Option | Description |
|---|---|
| `<path>` | Path in sandbox (e.g., `/app/src/index.ts`) |
| `--mcp-id <id>` | Specific MCP ID |
| `--output <file>` | Write to local file instead of stdout |
| `--base64` | Output as base64 (for binary files) |

### Write File

```
waniwani mcp file write <path>
```

Write a file to the MCP sandbox.

| Option | Description |
|---|---|
| `<path>` | Path in sandbox (e.g., `/app/src/index.ts`) |
| `--mcp-id <id>` | Specific MCP ID |
| `--content <content>` | Content to write (inline) |
| `--file <localFile>` | Local file to upload |
| `--base64` | Treat content as base64 encoded |

### List Files

```
waniwani mcp file list [path]
```

List files in the MCP sandbox.

| Option | Description |
|---|---|
| `[path]` | Directory path (defaults to `/app`) |
| `--mcp-id <id>` | Specific MCP ID |

## Examples

```bash
# List all files in the app directory
waniwani mcp file list

# Read a specific file
waniwani mcp file read /app/lib/my-mcp/tools/search.ts

# Write content to a file
waniwani mcp file write /app/lib/my-mcp/tools/new-tool.ts --file ./local-tool.ts

# Download a file locally
waniwani mcp file read /app/package.json --output ./package.json
```

## Note

These commands operate on the remote sandbox, not local files. For local development, use `waniwani mcp preview` which auto-syncs files.
