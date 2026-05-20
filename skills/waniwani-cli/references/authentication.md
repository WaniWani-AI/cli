# Authentication

Two auth modes, picked automatically based on what's available:

- **API key** (preferred for hosted servers / CI) — set `WANIWANI_API_KEY` or put `apiKey` in `waniwani.config.ts`. No login flow needed.
- **OAuth** (for local dev) — `waniwani login` runs an OAuth2 PKCE flow in the browser, stores tokens in `.waniwani/settings.json`. Tokens auto-refresh on 401.

The CLI checks API key first; if absent, falls back to OAuth. Same priority is used by every command that hits the API.

## API key

Get a key at [app.waniwani.ai](https://app.waniwani.ai) → Settings → API Keys. Then either:

```bash
export WANIWANI_API_KEY=wwk_...
waniwani <any-command>
```

Or in `waniwani.config.ts`:

```ts
export default {
  apiKey: process.env.WANIWANI_API_KEY,
  // ...
};
```

The env var route is the right call for CI and any environment where `.waniwani/settings.json` shouldn't exist.

API keys never expire and never refresh — if a key is rotated, the next request 401s with `API key authentication failed.` and you need to update the env var.

## OAuth (`waniwani login`)

```bash
waniwani login
```

What happens:

1. CLI dynamically registers an OAuth client with the WaniWani auth server (RFC 7591).
2. Opens the browser to the authorize URL with PKCE challenge.
3. Spins up a tiny local HTTP server on `localhost:54321` to receive the callback.
4. Exchanges the auth code for an access + refresh token.
5. Persists `accessToken`, `refreshToken`, `expiresAt`, `clientId` to `.waniwani/settings.json` in the **current working directory**. (No global config — auth is per-project.)
6. Fetches the active org and prints its name.

If `.waniwani/settings.json` already has a non-expired token, `waniwani login` no-ops with "Already logged in." Use `waniwani logout` to clear and re-login.

If the token is expired but the refresh token still works, login silently refreshes and exits.

Flags:

- `--no-browser` — skip auto-opening; the URL is printed for manual paste.

## Token refresh

Every API request goes through one auto-refresh on 401:

1. Request gets 401.
2. CLI calls `tryRefreshToken()` using the stored refresh token + client ID.
3. On success, retries the original request with the new access token.
4. On failure, throws `Session expired. Run 'waniwani login' to re-authenticate.`

This is transparent to commands — no per-command refresh logic. The retry happens once (no infinite loop on persistent 401s).

The 5-minute expiry buffer (`config.isTokenExpired()`) means tokens are treated as expired before they actually are, so refresh happens proactively when the CLI is invoked just after token expiry.

## `waniwani logout`

Wipes only the auth fields (`accessToken`, `refreshToken`, `expiresAt`, `clientId`) from `.waniwani/settings.json`. Keeps `apiUrl` and other non-auth settings.

```bash
waniwani logout
```

The file itself is not deleted — only auth fields are nulled. Useful when switching between environments (e.g. dev → prod) since you keep your `apiUrl` setting.

## Switching environments (prod ↔ staging)

OAuth tokens are bound to the issuing environment via the `resource` parameter (RFC 8707). A token issued by `app.waniwani.ai` will not work against `dev.waniwani.ai`.

To switch:

```bash
waniwani logout
export WANIWANI_API_URL=https://dev.waniwani.ai
waniwani login
```

Or persist the URL in `waniwani.config.ts` to avoid the env var:

```ts
export default {
  apiUrl: "https://dev.waniwani.ai",
  // ...
};
```

## When auth fails

| Error code | Meaning | Fix |
|---|---|---|
| `NOT_LOGGED_IN` | No API key, no OAuth token | `waniwani login` |
| `Session expired` | Refresh token also rejected | `waniwani login` |
| `API key authentication failed` | API key invalid or rotated | Update `WANIWANI_API_KEY` |
| `INVALID_STATE` (during login) | OAuth state param mismatch | Try again — usually a stale browser tab |
| `PORT_IN_USE` (during login) | Port 54321 occupied | Kill the other CLI instance |

## File locations

- `.waniwani/settings.json` — per-project. Created by `waniwani login`. Auth tokens live here.
- `waniwani.config.ts` — per-project. Created by `waniwani connect`. Project bindings + optional `apiKey`.

`.waniwani/` should be `.gitignore`d. `waniwani.config.ts` should be committed.
