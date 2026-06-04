import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api, forceOAuth } from "../lib/api.js";
import { auth } from "../lib/auth.js";
import { openBrowser } from "../lib/browser.js";
import { config } from "../lib/config.js";
import { CLIError, handleError } from "../lib/errors.js";
import {
	bindOrg,
	isInquirerCancellation,
	promptForOrg,
	switchToOrg,
} from "../lib/orgs.js";
import { formatOutput, formatSuccess } from "../lib/output.js";
import type {
	OAuthClientRegistrationResponse,
	OAuthTokenResponse,
	Org,
	OrgListResponse,
} from "../types/index.js";

// ASCII art logo for WaniWani
const LOGO_LINES = [
	"██╗    ██╗ █████╗ ███╗   ██╗ ██╗ ██╗    ██╗ █████╗ ███╗   ██╗ ██╗",
	"██║    ██║██╔══██╗████╗  ██║ ██║ ██║    ██║██╔══██╗████╗  ██║ ██║",
	"██║ █╗ ██║███████║██╔██╗ ██║ ██║ ██║ █╗ ██║███████║██╔██╗ ██║ ██║",
	"██║███╗██║██╔══██║██║╚██╗██║ ██║ ██║███╗██║██╔══██║██║╚██╗██║ ██║",
	"╚███╔███╔╝██║  ██║██║ ╚████║ ██║ ╚███╔███╔╝██║  ██║██║ ╚████║ ██║",
	" ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═╝  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═╝",
];

// 256-color gradient - warm tones inspired by WaniWani brand
const LOGO_COLORS = [
	"\x1b[38;5;223m", // light peach
	"\x1b[38;5;216m", // peach
	"\x1b[38;5;209m", // salmon
	"\x1b[38;5;203m", // coral
	"\x1b[38;5;167m", // warm red
	"\x1b[38;5;131m", // deep terracotta
];

const RESET = "\x1b[0m";

function showLogo(): void {
	console.log();
	for (let i = 0; i < LOGO_LINES.length; i++) {
		console.log(`${LOGO_COLORS[i]}${LOGO_LINES[i]}${RESET}`);
	}
	console.log();
}

const CALLBACK_PORT = 54321;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;
const CLIENT_NAME = "waniwani-cli";

function generateCodeVerifier(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return btoa(String.fromCharCode(...array))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function generateState(): string {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function registerClient(): Promise<OAuthClientRegistrationResponse> {
	const apiUrl = await config.getApiUrl();
	const response = await fetch(`${apiUrl}/api/auth/oauth2/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			client_name: CLIENT_NAME,
			redirect_uris: [CALLBACK_URL],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new CLIError(
			(error as { error_description?: string }).error_description ||
				"Failed to register OAuth client",
			"CLIENT_REGISTRATION_FAILED",
		);
	}

	return response.json() as Promise<OAuthClientRegistrationResponse>;
}

async function waitForCallback(
	expectedState: string,
	timeoutMs: number = 300000,
): Promise<string> {
	return new Promise((resolve, reject) => {
		let server: Server | null = null;
		const sockets = new Set<Socket>();

		const timeout = setTimeout(() => {
			cleanup();
			reject(new CLIError("Login timed out", "LOGIN_TIMEOUT"));
		}, timeoutMs);

		const cleanup = () => {
			clearTimeout(timeout);
			// Destroy all active connections to allow process to exit
			for (const socket of sockets) {
				socket.destroy();
			}
			sockets.clear();
			server?.close();
		};

		const htmlResponse = (title: string, message: string, isSuccess: boolean) =>
			`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - WaniWani</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
      position: relative;
      overflow: hidden;
    }
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      pointer-events: none;
    }
    .blob-1 {
      top: 0;
      left: 25%;
      width: 24rem;
      height: 24rem;
      background: linear-gradient(to bottom right, rgba(253, 224, 71, 0.3), rgba(251, 146, 60, 0.3));
    }
    .blob-2 {
      bottom: 0;
      right: 25%;
      width: 24rem;
      height: 24rem;
      background: linear-gradient(to bottom right, rgba(134, 239, 172, 0.3), rgba(52, 211, 153, 0.3));
    }
    .blob-3 {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40rem;
      height: 40rem;
      background: linear-gradient(to bottom right, rgba(255, 237, 213, 0.2), rgba(254, 249, 195, 0.2));
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2rem;
      padding: 2rem;
      z-index: 10;
      text-align: center;
    }
    .logo {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
      letter-spacing: -0.025em;
    }
    .icon-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${isSuccess ? "rgba(52, 211, 153, 0.15)" : "rgba(239, 68, 68, 0.15)"};
    }
    .icon {
      width: 40px;
      height: 40px;
      color: ${isSuccess ? "#10b981" : "#ef4444"};
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
    }
    p {
      font-size: 1.125rem;
      color: #64748b;
      max-width: 400px;
    }
  </style>
</head>
<body>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="container">
    <span class="logo">WaniWani</span>
    <div class="icon-circle">
      ${
				isSuccess
					? '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>'
					: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>'
			}
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

		try {
			server = createServer((req, res) => {
				const url = new URL(
					req.url || "/",
					`http://localhost:${CALLBACK_PORT}`,
				);

				if (url.pathname === "/callback") {
					const code = url.searchParams.get("code");
					const state = url.searchParams.get("state");
					const error = url.searchParams.get("error");

					res.setHeader("Content-Type", "text/html");

					if (error) {
						res.statusCode = 400;
						res.end(htmlResponse("Login Failed", `Error: ${error}`, false));
						cleanup();
						reject(new CLIError(`OAuth error: ${error}`, "OAUTH_ERROR"));
						return;
					}

					if (state !== expectedState) {
						res.statusCode = 400;
						res.end(
							htmlResponse(
								"Login Failed",
								"Invalid state parameter. Please try again.",
								false,
							),
						);
						cleanup();
						reject(new CLIError("Invalid state parameter", "INVALID_STATE"));
						return;
					}

					if (!code) {
						res.statusCode = 400;
						res.end(
							htmlResponse(
								"Login Failed",
								"No authorization code received.",
								false,
							),
						);
						cleanup();
						reject(new CLIError("No authorization code", "NO_CODE"));
						return;
					}

					res.statusCode = 200;
					res.end(
						htmlResponse(
							"Login Successful!",
							"You can close this window and return to the terminal.",
							true,
						),
					);

					// Schedule cleanup after response is sent
					setTimeout(() => {
						cleanup();
						resolve(code);
					}, 100);
					return;
				}

				res.statusCode = 404;
				res.end("Not found");
			});

			// Track connections so we can force-close them
			server.on("connection", (socket) => {
				sockets.add(socket);
				socket.on("close", () => sockets.delete(socket));
			});

			server.on("error", (err: NodeJS.ErrnoException) => {
				cleanup();
				if (err.code === "EADDRINUSE") {
					reject(
						new CLIError(
							`Port ${CALLBACK_PORT} is already in use. Close any other WaniWani CLI instances and try again.`,
							"PORT_IN_USE",
						),
					);
				} else {
					reject(err);
				}
			});

			server.listen(CALLBACK_PORT);
		} catch (err: unknown) {
			cleanup();
			reject(err);
		}
	});
}

async function exchangeCodeForToken(
	code: string,
	codeVerifier: string,
	clientId: string,
	resource: string,
): Promise<OAuthTokenResponse> {
	const apiUrl = await config.getApiUrl();
	const response = await fetch(`${apiUrl}/api/auth/oauth2/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: CALLBACK_URL,
			client_id: clientId,
			code_verifier: codeVerifier,
			resource, // RFC 8707 - required to get JWT token
		}).toString(),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new CLIError(
			(error as { error_description?: string }).error_description ||
				"Failed to exchange code for token",
			"TOKEN_EXCHANGE_FAILED",
		);
	}

	return response.json() as Promise<OAuthTokenResponse>;
}

/**
 * Run the OAuth2 PKCE login flow end-to-end: register client, open browser,
 * wait for callback, exchange code, persist tokens.
 *
 * Caller is responsible for any "already logged in" short-circuits and any
 * pre/post UI (logo, success messages). Throws on failure.
 */
export async function runLoginFlow(
	opts: { openBrowser?: boolean } = {},
): Promise<{
	orgName: string | null;
	orgs: Org[];
	activeOrgId: string | null;
}> {
	const { openBrowser: shouldOpenBrowser = true } = opts;

	// Login is always OAuth — strip any API key so the trailing org lookup
	// (and any later user-scoped calls in the same process) uses tokens.
	forceOAuth();

	const spinner = ora("Registering client...").start();

	const { client_id: clientId } = await registerClient();

	spinner.text = "Preparing authentication...";

	const codeVerifier = generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);
	const state = generateState();

	const apiUrl = await config.getApiUrl();
	const authUrl = new URL(`${apiUrl}/api/auth/oauth2/authorize`);
	authUrl.searchParams.set("client_id", clientId);
	authUrl.searchParams.set("redirect_uri", CALLBACK_URL);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("code_challenge", codeChallenge);
	authUrl.searchParams.set("code_challenge_method", "S256");
	authUrl.searchParams.set("state", state);
	authUrl.searchParams.set("resource", apiUrl); // RFC 8707 - request JWT token

	spinner.stop();

	console.log("Opening browser for authentication...\n");
	console.log("If the browser doesn't open, visit:\n");
	console.log(chalk.cyan(`  ${authUrl.toString()}`));
	console.log();

	const callbackPromise = waitForCallback(state);

	if (shouldOpenBrowser) {
		await openBrowser(authUrl.toString());
	}

	spinner.start("Waiting for authorization...");

	const code = await callbackPromise;

	spinner.text = "Exchanging code for token...";

	const tokenResponse = await exchangeCodeForToken(
		code,
		codeVerifier,
		clientId,
		apiUrl,
	);

	await config.ensureConfigDir();
	await auth.setTokens(
		tokenResponse.access_token,
		tokenResponse.refresh_token,
		tokenResponse.expires_in,
		clientId,
		apiUrl, // Bind tokens to the env that issued them — used for drift detection.
	);

	spinner.succeed("Logged in successfully!");

	let orgName: string | null = null;
	let orgs: Org[] = [];
	let activeOrgId: string | null = null;
	try {
		const result = await api.get<OrgListResponse>("/api/oauth/orgs");
		orgs = result.orgs;
		// The org to bind this grant to: the active org the server resolved, or
		// the sole membership when no active org is set. A multi-org user with no
		// active org is left for the post-login picker (selectOrgAfterLogin) to
		// bind, so we don't arbitrarily pick one here.
		activeOrgId = result.activeOrgId ?? (orgs.length === 1 ? orgs[0].id : null);
		if (activeOrgId) {
			const id = activeOrgId;
			orgName = orgs.find((o) => o.id === id)?.name ?? null;
			// Bind this grant to that org. The binding rides the grant's refresh
			// token, so later web-app org switches (or a concurrent CLI) can no
			// longer move this token's org — only an explicit `waniwani switch`
			// does. The just-minted token already represents this org, so no
			// refresh is needed (and we avoid rotating a freshly issued session).
			await bindOrg(id);
		}
	} catch {
		// Org binding is best-effort — don't fail login on lookup/bind error.
		// An unbound token falls back to the user's active org at mint, and the
		// next switch/connect re-binds it.
	}

	return { orgName, orgs, activeOrgId };
}

/**
 * After an interactive login, let a multi-org user pick which org the CLI should
 * act in — the same picker as `waniwani switch`. With a single org (or if the
 * org lookup failed) there's nothing to choose, so we just echo the bound org.
 * Login already bound the active org, so keeping it needs no work; only a
 * different choice triggers a switch (re-bind + refresh). A cancelled picker
 * (Ctrl-C) leaves the active-org binding in place.
 */
async function selectOrgAfterLogin(
	orgs: Org[],
	activeOrgId: string | null,
	orgName: string | null,
): Promise<void> {
	const echoActive = () => {
		if (orgName) {
			console.log(`  Organization: ${chalk.cyan(orgName)}`);
		}
	};

	if (orgs.length <= 1) {
		echoActive();
		return;
	}

	let chosen: Org;
	try {
		chosen = await promptForOrg(orgs, activeOrgId);
	} catch (error) {
		if (isInquirerCancellation(error)) {
			echoActive();
			return;
		}
		throw error;
	}

	if (chosen.id === activeOrgId) {
		console.log(`  Organization: ${chalk.cyan(chosen.name)}`);
		return;
	}

	const spinner = ora(`Switching to ${chosen.name}...`).start();
	await switchToOrg(chosen.id);
	spinner.stop();
	formatSuccess(`Switched to ${chalk.cyan(chosen.name)}`, false);
}

/**
 * Guarantee the caller is authenticated before returning. If OAuth tokens are
 * valid (or refreshable), no-op. Otherwise, run the interactive login flow.
 *
 * Always interactive — callers that need a non-interactive path should check
 * `auth.isLoggedIn()` themselves and short-circuit.
 *
 * TODO: when org-scoped API keys land, short-circuit if `WANIWANI_API_KEY` is
 * set (let machines skip the browser flow entirely).
 */
export async function ensureLoggedIn(): Promise<void> {
	// Any caller of ensureLoggedIn is user-scoped — make sure subsequent API
	// calls use OAuth, not the project-scoped API key from .env / config.
	forceOAuth();

	if (await auth.isLoggedIn()) {
		if (!(await auth.isTokenExpired())) return;
		if (await auth.tryRefreshToken()) return;
		console.log(chalk.yellow("Session expired. Starting new login flow..."));
		await auth.clear();
	} else {
		console.log(chalk.gray("Not logged in. Let's get you authenticated..."));
	}
	console.log();

	await runLoginFlow();
	console.log();
}

export const loginCommand = new Command("login")
	.description("Log in to WaniWani")
	.option("--no-browser", "Don't open the browser automatically")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			if (await auth.isLoggedIn()) {
				if (await auth.isTokenExpired()) {
					const refreshed = await auth.tryRefreshToken();
					if (refreshed) {
						if (json) {
							formatOutput({ alreadyLoggedIn: true, refreshed: true }, true);
						} else {
							console.log(
								chalk.green("Session refreshed. You're still logged in."),
							);
						}
						return;
					}
					if (!json) {
						console.log(
							chalk.yellow("Session expired. Starting new login flow..."),
						);
					}
					await auth.clear();
				} else {
					if (json) {
						formatOutput({ alreadyLoggedIn: true }, true);
					} else {
						console.log(
							chalk.yellow(
								"Already logged in. Use 'waniwani logout' to log out first.",
							),
						);
					}
					return;
				}
			}

			if (!json) {
				showLogo();
			}

			const { orgName, orgs, activeOrgId } = await runLoginFlow({
				openBrowser: options.browser !== false,
			});

			if (json) {
				formatOutput(
					{ success: true, loggedIn: true, ...(orgName && { org: orgName }) },
					true,
				);
			} else {
				console.log();
				formatSuccess("You're now logged in to WaniWani!", false);
				await selectOrgAfterLogin(orgs, activeOrgId, orgName);
				console.log();
				console.log("Get started:");
				console.log(
					"  waniwani connect    Connect this repo to an agent (or create one)",
				);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
