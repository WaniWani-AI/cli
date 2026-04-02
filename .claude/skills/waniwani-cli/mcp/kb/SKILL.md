---
name: mcp-kb
description: MCP knowledge base management - ingest markdown files, search content, and list sources. Use when the user needs to manage their MCP's knowledge base for RAG/retrieval.
allowed-tools: Bash(waniwani:*), Read, Glob, Write
---

# MCP Knowledge Base Management

Manage your MCP's knowledge base for RAG/retrieval. The knowledge base stores markdown content as vector-embedded chunks, searchable via semantic similarity.

## Commands

### Ingest

```bash
waniwani mcp kb ingest
```

Ingest markdown files into the knowledge base.

**Options:**
- `-d, --dir <path>` - Path to knowledge base directory (overrides config)

**Default directory:** `./knowledge-base` (or `knowledgeBase.dir` from `waniwani.config.ts`)

Behavior:
- Recursively finds all `.md` files in the directory
- Batches files (max 100 per request) and sends to the API
- **Ingestion is destructive** - it replaces ALL existing KB chunks. Every ingest call wipes the previous content and re-ingests from scratch.

### Sources

```bash
waniwani mcp kb sources
```

List all ingested knowledge base sources. Shows source filename, chunk count, and ingestion date. Useful to verify what has been ingested.

### Search

```bash
waniwani mcp kb search <query>
```

Search the knowledge base by semantic similarity.

**Arguments:**
- `<query>` - Search query text (1-1000 characters)

**Options:**
- `-k, --top-k <number>` - Number of results, 1-20 (default: 5)
- `-s, --min-score <number>` - Minimum similarity score, 0-1 (default: 0.3)

Returns results with source, heading, content preview, and similarity score.

## Configuration

Knowledge base settings live in `waniwani.config.ts`:

```typescript
import { defineConfig } from "@waniwani/sdk";

export default defineConfig({
  apiKey: process.env.WANIWANI_API_KEY,
  knowledgeBase: {
    dir: "./knowledge-base",  // default
  },
});
```

## Authentication

KB commands require authentication. They support:

1. **API key auth:** `WANIWANI_API_KEY` env var or `apiKey` in `waniwani.config.ts`
2. **OAuth:** `waniwani login` (stored in `.waniwani/settings.json`)

## Knowledge Base Directory Structure

```
knowledge-base/
├── getting-started.md
├── api-reference.md
├── guides/
│   ├── authentication.md
│   └── advanced-usage.md
└── faq.md
```

## How Chunking Works

- Markdown files are automatically chunked by H2 headings (`## Section`)
- Each section becomes a separate searchable chunk
- Metadata from file structure is preserved
- Uses OpenAI text-embedding-3-small for vector embeddings

## Typical Workflow

```bash
# Set up knowledge base directory
mkdir knowledge-base
# Add markdown files...

# Ingest all files
waniwani mcp kb ingest

# Verify ingestion
waniwani mcp kb sources

# Test search
waniwani mcp kb search "how to authenticate"
```

## Constraints

- Max 100 files per ingest batch (batched automatically)
- Filename: 1-255 characters
- Content: 1-500,000 characters per file
- Search query: 1-1,000 characters
- Search results: 1-20 per query

All commands support the `--json` global flag for machine-readable output.
