# Git Credential Helper

WaniWani-managed repos live under the WaniWani GitHub App. Users don't have direct push access — the app issues short-lived installation tokens on demand. The git credential helper bridges this gap so standard `git push` works transparently.

## How it works

```
User runs: git push origin main
          │
          ▼
Git needs credentials for github.com
          │
          ▼
Git reads .git/config:
  [credential]
    helper = !/path/to/bun /path/to/waniwani git-credential-helper
          │
          ▼
Git invokes: waniwani git-credential-helper get
  stdin: protocol=https\nhost=github.com\n\n
          │
          ▼
Credential helper:
  1. Finds .waniwani/settings.json (walks up from cwd)
  2. Reads mcpId from config
  3. GET /api/mcp/repositories/{mcpId}/git-auth
     → Returns { username: "x-access-token", token: "<installation-token>" }
  4. Writes to stdout: username=x-access-token\npassword=<token>\n
          │
          ▼
Git pushes with the token. Vercel webhook triggers deploy.
```

## Setup

The credential helper is configured automatically during `waniwani mcp create` and `waniwani mcp clone`. It writes a local (repo-level) git config entry:

```
git config --local credential.helper "!/absolute/path/to/waniwani git-credential-helper"
```

The absolute path avoids PATH resolution issues across different environments (global install, bun, npx). The `!` prefix tells git this is a shell command, not a binary name.

## Key files

| File | Purpose |
|------|---------|
| `src/commands/git-credential-helper.ts` | The credential helper command — reads stdin, fetches token, writes stdout |
| `src/lib/credential-helper-setup.ts` | Configures `.git/config` with the credential helper (used by create/clone) |
| `src/lib/git-auth.ts` | `getGitAuthContext()` — fetches ephemeral tokens from the API |

## Protocol

Git credential helpers follow a simple protocol ([docs](https://git-scm.com/docs/git-credential#IOFMT)):

- Git calls `<helper> get` and sends key=value pairs on stdin (terminated by blank line)
- Helper responds with `username=...\npassword=...\n` on stdout
- Git also calls `store` (after success) and `erase` (after rejection) — we no-op both since tokens are ephemeral

## Error handling

The helper must never write partial output to stdout on failure — git would interpret it as credentials. All errors go to stderr, and the process exits with code 1. Git then falls through to other configured credential helpers (or fails).

Failure modes:
- **No `.waniwani/` found**: exits 1, stderr message. Git falls through.
- **No `mcpId` in config**: exits 1, stderr message.
- **API unreachable**: the fetch throws, caught and written to stderr.
- **Expired OAuth token**: `api.get()` auto-refreshes via `auth.tryRefreshToken()`. If refresh fails, the error surfaces in stderr telling the user to run `waniwani login`.
- **Non-HTTPS protocol**: exits 0 silently (we only handle HTTPS).

## Security

- Credentials are **never stored** in `.git/config` or on disk — they're fetched on demand and passed through stdout/stdin pipes.
- Tokens are short-lived GitHub App installation tokens (~1 hour expiry).
- The credential helper config is **local to the repo** (`--local`), never global.
- The WaniWani OAuth token (used to request the git token) is stored in `.waniwani/settings.json` with `0o600` permissions.

## What this replaced

Previously, `waniwani mcp publish` handled the entire push flow:
1. `git add -A`
2. `git commit -m <message>`
3. Fetch ephemeral credentials
4. Push via `GIT_ASKPASS` temp script
5. Report commit SHA

This was removed in favor of letting users use standard git commands. The credential helper makes step 3-4 transparent.
