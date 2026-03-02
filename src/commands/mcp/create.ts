import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import {
	CONFIG_FILE_NAME,
	initConfigAt,
	LOCAL_CONFIG_DIR,
} from "../../lib/config.js";
import { setupGitCredentialHelper } from "../../lib/credential-helper-setup.js";
import { CLIError, handleError } from "../../lib/errors.js";
import {
	getGitAuthContext,
	revokeGitHubInstallationToken,
	runGitWithCredentials,
} from "../../lib/git-auth.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type { McpRepository } from "../../types/index.js";

/**
 * Load parent .waniwani/settings.json if it exists.
 * Copies all settings including auth tokens, but excludes mcpId (new project gets its own).
 */
async function loadParentConfig(
	cwd: string,
): Promise<Record<string, unknown> | null> {
	const parentConfigPath = join(cwd, LOCAL_CONFIG_DIR, CONFIG_FILE_NAME);
	if (!existsSync(parentConfigPath)) {
		return null;
	}

	try {
		const content = await readFile(parentConfigPath, "utf-8");
		const config = JSON.parse(content);
		// Remove mcpId from parent - the new project gets its own
		// Keep auth tokens so user doesn't need to re-login
		const { mcpId: _, sessionId: __, ...rest } = config;
		return rest;
	} catch {
		return null;
	}
}

function checkGitInstalled(): void {
	try {
		execSync("git --version", { stdio: "ignore" });
	} catch {
		throw new CLIError(
			"git is required but not found. Install it from https://git-scm.com/",
			"GIT_NOT_FOUND",
		);
	}
}

export const createCommand = new Command("create")
	.description("Create a new MCP project")
	.argument("<name>", "Name for the MCP project")
	.action(async (name: string, _options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const cwd = process.cwd();
			const projectDir = join(cwd, name);

			// Check if directory already exists
			if (existsSync(projectDir)) {
				if (json) {
					formatOutput(
						{
							success: false,
							error: `Directory "${name}" already exists`,
						},
						true,
					);
				} else {
					console.error(`Error: Directory "${name}" already exists`);
				}
				process.exit(1);
			}

			// Check git is installed before making API calls
			checkGitInstalled();

			// Create repository on backend (GitHub repo created immediately)
			const spinner = ora("Creating MCP...").start();

			const result = await api.post<McpRepository>("/api/mcp/repositories", {
				name,
			});

			// Get authenticated clone context
			spinner.text = "Cloning repository...";
			const gitAuth = await getGitAuthContext(result.id);

			// Clone the repository
			try {
				runGitWithCredentials(["clone", gitAuth.remoteUrl, projectDir], {
					stdio: "ignore",
					credentials: gitAuth.credentials,
				});
			} catch {
				spinner.fail("Failed to clone repository");
				throw new CLIError(
					`Failed to clone repository. Ensure git is configured correctly.`,
					"CLONE_FAILED",
				);
			} finally {
				await revokeGitHubInstallationToken(gitAuth);
			}

			// Keep origin clean (no embedded credentials/signatures)
			execFileSync(
				"git",
				["remote", "set-url", "origin", result.githubCloneUrl],
				{
					cwd: projectDir,
					stdio: "ignore",
				},
			);

			// Create .waniwani/settings.json with mcpId (after clone so dir exists)
			const parentConfig = await loadParentConfig(cwd);
			await initConfigAt(projectDir, {
				...parentConfig,
				mcpId: result.id,
			});

			// Set up git credential helper for transparent git push
			setupGitCredentialHelper(projectDir);

			spinner.succeed("MCP project created");

			if (json) {
				formatOutput(
					{
						success: true,
						projectDir,
						mcpId: result.id,
					},
					true,
				);
			} else {
				console.log();
				formatSuccess(`MCP "${name}" created!`, false);
				console.log();
				console.log("Next steps:");
				console.log(`  cd ${name}`);
				console.log("  waniwani mcp preview      # Start developing");
				console.log("  git push origin main      # Deploy");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
