# MCP Template Architecture Guide

This document explains how the mcp-template works and defines boundaries between framework code and user-customizable code.

## What is This Template?

This is a **Next.js 15 application** that serves as an MCP (Model Context Protocol) server designed for **ChatGPT integration**. It provides:

- MCP endpoint at `/mcp` for ChatGPT to communicate with
- Tools (functions the AI can call)
- Widgets (UI components rendered in ChatGPT)

## Project Structure Overview

```
mcp-template/
├── app/                           # Next.js App Router
│   ├── mcp/route.ts              # MCP endpoint handler (CUSTOMIZE)
│   ├── layout.tsx                # Root layout with ChatGPT initialization
│   ├── page.tsx                  # Home page/status endpoint
│   └── ({{MCP_NAME}})/           # Widget pages (CUSTOMIZE)
│       └── greeting/page.tsx     # Example widget page
├── lib/
│   ├── shared/                   # FRAMEWORK - DO NOT MODIFY
│   │   ├── tools/@utils/         # Tool creation utilities
│   │   ├── widgets/@utils/       # Widget registration utilities
│   │   ├── hooks/                # React hooks for ChatGPT integration
│   │   ├── components/           # Shared React components
│   │   └── translations/         # i18n system
│   └── {{MCP_NAME}}/             # YOUR CODE - CUSTOMIZE THIS
│       ├── tools/                # Your tool implementations
│       └── widgets/              # Your widget definitions
├── baseUrl.ts                    # Vercel deployment URL helper
├── package.json                  # Dependencies
└── next.config.ts                # Next.js config
```

---

## Code Boundaries

### DO NOT MODIFY: `lib/shared/`

This directory contains framework infrastructure that handles:

| Directory | Purpose |
|-----------|---------|
| `tools/@utils/` | `createTool()` factory, tool registration |
| `widgets/@utils/` | `createWidget()` factory, widget HTML fetching, resource registration |
| `hooks/` | React hooks: `useWidgetProps()`, `useDisplayMode()`, `useSafeArea()`, etc. |
| `components/` | `InitializeNextJsInChatGpt` - patches Next.js to run in ChatGPT iframe |
| `translations/` | i18n locale matching and translation helpers |

**Why not modify?** These utilities handle complex MCP protocol details, ChatGPT iframe patching, and OpenAI API integration. Modifying them can break the entire MCP server.

### CUSTOMIZE: `lib/{{MCP_NAME}}/`

This is where your domain-specific code lives:

| Directory | What to Add |
|-----------|-------------|
| `tools/` | New tool files + register in `index.ts` |
| `widgets/` | New widget definitions (paired with Next.js pages) |

### CAN CUSTOMIZE

| File | What You Can Change |
|------|---------------------|
| `app/mcp/route.ts` | Register your tools and widgets |
| `app/({{MCP_NAME}})/*/page.tsx` | Add widget pages |
| `app/page.tsx` | Home page content |
| `next.config.ts` | Next.js configuration |

---

## How Tools Work

Tools are functions that ChatGPT can invoke. They're defined using `createTool()`:

```typescript
// lib/{{MCP_NAME}}/tools/my-tool.ts
import { z } from "zod";
import { createTool } from "@/lib/shared/tools/@utils/create-tool";

export const myTool = createTool(
  {
    id: "my_tool",
    title: "My Tool",
    description: "Description for the AI",
    inputSchema: {
      param: z.string().describe("Parameter description"),
    },
    annotations: {
      readOnlyHint: true,      // Doesn't modify state
      openWorldHint: false,    // Scoped, not open-ended
      destructiveHint: false,  // Can't delete data
    },
  },
  async ({ param }) => ({
    text: `Result: ${param}`,
  })
);
```

**Registration in `lib/{{MCP_NAME}}/tools/index.ts`:**
```typescript
import { myTool } from "./my-tool";
const allTools = [helloTool, myTool]; // Add here
```

---

## How Widgets Work

Widgets are tools that render UI in ChatGPT. They require:
1. **Widget definition** in `lib/{{MCP_NAME}}/widgets/`
2. **Next.js page** in `app/({{MCP_NAME}})/`

### Widget Definition

```typescript
// lib/{{MCP_NAME}}/widgets/my-widget/index.tsx
import { z } from "zod";
import { createWidget } from "@/lib/shared/widgets/@utils/create-widget";

export interface MyWidgetProps extends Record<string, unknown> {
  data: string;
  locale: string;
}

export const myWidget = createWidget(
  {
    id: "my_widget",
    title: "My Widget",
    description: "Description for when to show this",
    htmlPath: "/my-widget",  // Must match page route
    inputSchema: {
      data: z.string().describe("Data to display"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  },
  async ({ data }, { locale }) => ({
    text: `Displaying: ${data}`,
    data: { data, locale } satisfies MyWidgetProps,
  })
);
```

### Widget Page

```typescript
// app/({{MCP_NAME}})/my-widget/page.tsx
"use client";

import type { MyWidgetProps } from "@/lib/{{MCP_NAME}}/widgets/my-widget";
import { useWidgetProps } from "@/lib/shared/hooks/use-widget-props";
import { useDisplayMode, useRequestDisplayMode, useSafeArea } from "@/lib/shared/hooks";

export default function MyWidgetPage() {
  const props = useWidgetProps<MyWidgetProps>();
  const displayMode = useDisplayMode();        // "inline" | "fullscreen" | "pip"
  const requestDisplayMode = useRequestDisplayMode();
  const safeArea = useSafeArea();

  if (!props) return <div>Loading...</div>;

  return <div>{props.data}</div>;
}
```

### Widget Registration

In `app/mcp/route.ts`:
```typescript
await registerWidgets(server, [greetingWidget, myWidget]);
```

---

## ChatGPT Integration Details

### How the Iframe Works

Widgets run inside ChatGPT's iframe. The framework handles:

- **Base URL patching** - Ensures relative URLs resolve correctly
- **History API patching** - Prevents navigation issues
- **Fetch interception** - Rewrites same-origin requests
- **External link handling** - Uses `window.openai.openExternal()`

### Available OpenAI Globals

Inside widget pages, you have access to:

```typescript
window.openai.theme           // "light" | "dark"
window.openai.locale          // User's locale
window.openai.displayMode     // "inline" | "fullscreen" | "pip"
window.openai.toolOutput      // Data from widget handler
window.openai.safeArea        // Screen insets for notches
```

### React Hooks (from `lib/shared/hooks/`)

| Hook | Returns | Purpose |
|------|---------|---------|
| `useWidgetProps<T>()` | `T \| undefined` | Get data passed from widget handler |
| `useDisplayMode()` | `"inline" \| "fullscreen" \| "pip"` | Current display mode |
| `useRequestDisplayMode()` | `(mode) => Promise` | Change display mode |
| `useSafeArea()` | `{ top, bottom, left, right }` | Screen safe area insets |
| `useOpenAIGlobal(key)` | `any` | Access any OpenAI global |

---

## Deployment

### Base URL Resolution

The template automatically detects the correct base URL:

- **Development:** `http://localhost:3000`
- **Vercel Production:** Uses `VERCEL_PROJECT_PRODUCTION_URL`
- **Vercel Preview:** Uses `VERCEL_BRANCH_URL` or `VERCEL_URL`

### Deploy to Vercel

```bash
vercel
```

The MCP endpoint will be at `https://your-project.vercel.app/mcp`

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `mcp-handler` | High-level MCP server wrapper |
| `zod` | Schema validation for tool inputs |
| `next` | React framework |

---

## Common Mistakes to Avoid

1. **Modifying `lib/shared/`** - This breaks the framework
2. **Forgetting to register tools/widgets** - Add to `index.ts` and `route.ts`
3. **Mismatched `htmlPath`** - Widget's `htmlPath` must match the Next.js page route
4. **Using npm/yarn/pnpm** - Always use `bun`
5. **Creating tool without `.describe()`** - AI needs descriptions to understand parameters

---

## Quick Reference

### Add a Tool
1. Create `lib/{{MCP_NAME}}/tools/my-tool.ts` using `createTool()`
2. Add to `allTools` array in `lib/{{MCP_NAME}}/tools/index.ts`

### Add a Widget
1. Create `lib/{{MCP_NAME}}/widgets/my-widget/index.tsx` using `createWidget()`
2. Create `app/({{MCP_NAME}})/my-widget/page.tsx` client component
3. Register in `app/mcp/route.ts` with `registerWidgets()`
