import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { auth } from "../lib/auth.js";
import { CLIError, handleError } from "../lib/errors.js";
import { formatOutput, formatSuccess } from "../lib/output.js";
import type { OAuthTokenResponse } from "../types/index.js";

const API_BASE_URL = process.env.WANIWANI_API_URL || "https://waniwani.com";
const CALLBACK_PORT = 54321;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;
const CLIENT_ID = "waniwani-cli";

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

async function openBrowser(url: string): Promise<void> {
	const [cmd, ...args] =
		process.platform === "darwin"
			? ["open", url]
			: process.platform === "win32"
				? ["cmd", "/c", "start", url]
				: ["xdg-open", url];

	spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

async function waitForCallback(
	expectedState: string,
	timeoutMs: number = 300000,
): Promise<string> {
	return new Promise((resolve, reject) => {
		let server: Server | null = null;

		const timeout = setTimeout(() => {
			server?.close();
			reject(new CLIError("Login timed out", "LOGIN_TIMEOUT"));
		}, timeoutMs);

		const cleanup = () => {
			clearTimeout(timeout);
			server?.close();
		};

		const htmlResponse = (title: string, message: string, color: string) =>
			`<html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1 style="color: ${color};">${title}</h1>
          <p>${message}</p>
          <p>You can close this window.</p>
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
						res.end(htmlResponse("Login Failed", `Error: ${error}`, "#ef4444"));
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
								"#ef4444",
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
								"#ef4444",
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
							"#22c55e",
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
): Promise<OAuthTokenResponse> {
	const response = await fetch(`${API_BASE_URL}/api/auth/oauth2/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: CALLBACK_URL,
			client_id: CLIENT_ID,
			code_verifier: codeVerifier,
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

export const loginCommand = new Command("login")
	.description("Log in to WaniWani")
	.option("--no-browser", "Don't open the browser automatically")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			// Check if already logged in
			if (await auth.isLoggedIn()) {
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

			if (!json) {
				console.log(chalk.bold("\nWaniWani CLI Login\n"));
			}

			// Generate PKCE values
			const codeVerifier = generateCodeVerifier();
			const codeChallenge = await generateCodeChallenge(codeVerifier);
			const state = generateState();

			// Build authorization URL
			const authUrl = new URL(`${API_BASE_URL}/oauth/authorize`);
			authUrl.searchParams.set("client_id", CLIENT_ID);
			authUrl.searchParams.set("redirect_uri", CALLBACK_URL);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set("code_challenge", codeChallenge);
			authUrl.searchParams.set("code_challenge_method", "S256");
			authUrl.searchParams.set("state", state);

			if (!json) {
				console.log("Opening browser for authentication...\n");
				console.log(`If the browser doesn't open, visit:\n`);
				console.log(chalk.cyan(`  ${authUrl.toString()}`));
				console.log();
			}

			// Start callback server and open browser
			const callbackPromise = waitForCallback(state);

			if (options.browser !== false) {
				await openBrowser(authUrl.toString());
			}

			const spinner = ora("Waiting for authorization...").start();

			// Wait for callback with auth code
			const code = await callbackPromise;

			spinner.text = "Exchanging code for token...";

			// Exchange code for token
			const tokenResponse = await exchangeCodeForToken(code, codeVerifier);

			// Store tokens
			await auth.setTokens(
				tokenResponse.access_token,
				tokenResponse.refresh_token,
				tokenResponse.expires_in,
			);

			spinner.succeed("Logged in successfully!");

			if (json) {
				formatOutput({ success: true, loggedIn: true }, true);
			} else {
				console.log();
				formatSuccess("You're now logged in to WaniWani!", false);
				console.log();
				console.log("Get started:");
				console.log(
					"  waniwani mcp create my-server    Create a new MCP sandbox",
				);
				console.log('  waniwani task "Add a tool"       Send tasks to Claude');
				console.log(
					"  waniwani org list                View your organizations",
				);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
