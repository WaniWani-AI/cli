import { execFileSync, type StdioOptions } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CloneUrlResponse, GitAuthResponse } from "../types/index.js";
import { ApiError, api } from "./api.js";

export interface GitHttpCredentials {
	username: string;
	password: string;
}

export interface GitAuthContext {
	cloneUrl: string;
	remoteUrl: string;
	credentials: GitHttpCredentials | null;
	githubApiBaseUrl: string | null;
}

/**
 * Convert a remote URL to GitHub API base URL (cloud or GHES).
 */
function getGitHubApiBaseUrl(remoteUrl: string): string | null {
	try {
		const parsed = new URL(remoteUrl);
		return parsed.hostname === "github.com" ||
			parsed.hostname === "www.github.com"
			? "https://api.github.com"
			: `${parsed.protocol}//${parsed.host}/api/v3`;
	} catch {
		return null;
	}
}

/**
 * Parse clone-url endpoint response and split credentialed clone URLs into:
 * - remoteUrl: safe URL without embedded credentials
 * - credentials: username/password for transient auth
 */
function parseCloneUrlAuth(cloneUrl: string): GitAuthContext {
	try {
		const parsed = new URL(cloneUrl);
		const username = decodeURIComponent(parsed.username);
		const password = decodeURIComponent(parsed.password);

		if (username && password) {
			parsed.username = "";
			parsed.password = "";
			const remoteUrl = parsed.toString();

			return {
				cloneUrl,
				remoteUrl,
				credentials: { username, password },
				githubApiBaseUrl: getGitHubApiBaseUrl(remoteUrl),
			};
		}
	} catch {
		// If cloneUrl is not parseable as URL (unlikely), use it as-is.
	}

	return {
		cloneUrl,
		remoteUrl: cloneUrl,
		credentials: null,
		githubApiBaseUrl: null,
	};
}

/**
 * Fetch git auth context from backend. Prefers structured /git-auth endpoint,
 * falls back to /clone-url for backward compatibility with older backends.
 */
export async function getGitAuthContext(
	mcpId: string,
): Promise<GitAuthContext> {
	try {
		const gitAuth = await api.get<GitAuthResponse>(
			`/api/mcp/repositories/${mcpId}/git-auth`,
		);
		const parsedRemote = new URL(gitAuth.remoteUrl);
		parsedRemote.username = gitAuth.username;
		parsedRemote.password = gitAuth.token;
		const cloneUrl = parsedRemote.toString();

		return {
			cloneUrl,
			remoteUrl: gitAuth.remoteUrl,
			credentials: {
				username: gitAuth.username,
				password: gitAuth.token,
			},
			githubApiBaseUrl: getGitHubApiBaseUrl(gitAuth.remoteUrl),
		};
	} catch (error) {
		// If the new endpoint isn't available yet, use legacy clone-url.
		if (error instanceof ApiError && error.statusCode !== 404) {
			throw error;
		}

		const { cloneUrl } = await api.get<CloneUrlResponse>(
			`/api/mcp/repositories/${mcpId}/clone-url`,
		);
		return parseCloneUrlAuth(cloneUrl);
	}
}

/**
 * Run a git command with ephemeral credentials via GIT_ASKPASS.
 * Credentials are only exposed in process env for this single command.
 */
export function runGitWithCredentials(
	args: string[],
	options?: {
		cwd?: string;
		stdio?: StdioOptions;
		credentials?: GitHttpCredentials | null;
	},
): void {
	const { cwd, stdio = "ignore", credentials = null } = options ?? {};

	if (!credentials) {
		execFileSync("git", args, { cwd, stdio });
		return;
	}

	const dir = mkdtempSync(join(tmpdir(), "waniwani-askpass-"));
	const askpassPath = join(dir, "askpass.sh");

	try {
		writeFileSync(
			askpassPath,
			`#!/bin/sh
case "$1" in
  *sername*) printf '%s\\n' "$WANIWANI_GIT_USERNAME" ;;
  *assword*) printf '%s\\n' "$WANIWANI_GIT_PASSWORD" ;;
  *) printf '\\n' ;;
esac
`,
			"utf-8",
		);
		chmodSync(askpassPath, 0o700);

		execFileSync("git", ["-c", "credential.helper=", ...args], {
			cwd,
			stdio,
			env: {
				...process.env,
				GIT_ASKPASS: askpassPath,
				GIT_TERMINAL_PROMPT: "0",
				WANIWANI_GIT_USERNAME: credentials.username,
				WANIWANI_GIT_PASSWORD: credentials.password,
			},
		});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * Best-effort revocation for GitHub App installation tokens.
 * If the token type/host doesn't support this endpoint, this is a no-op.
 */
export async function revokeGitHubInstallationToken(
	auth: GitAuthContext,
): Promise<void> {
	if (!auth.credentials?.password || !auth.githubApiBaseUrl) return;

	try {
		await fetch(`${auth.githubApiBaseUrl}/installation/token`, {
			method: "DELETE",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${auth.credentials.password}`,
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
	} catch {
		// Best-effort only; token still naturally expires.
	}
}
