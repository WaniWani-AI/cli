import { execSync } from "node:child_process";
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
import { CLIError, handleError, McpError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type {
	CloneUrlResponse,
	McpRepository,
	McpRepositoryListResponse,
} from "../../types/index.js";

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

export const cloneCommand = new Command("clone")
	.description("Clone an existing MCP project to a local directory")
	.argument("<name>", "Name of the MCP to clone")
	.argument("[directory]", "Directory to clone into (defaults to MCP name)")
	.action(async (name: string, directory: string | undefined, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const cwd = process.cwd();
			const dirName = directory ?? name;
			const projectDir = join(cwd, dirName);

			// Check if directory already exists
			if (existsSync(projectDir)) {
				if (json) {
					formatOutput(
						{
							success: false,
							error: `Directory "${dirName}" already exists`,
						},
						true,
					);
				} else {
					console.error(`Error: Directory "${dirName}" already exists`);
				}
				process.exit(1);
			}

			checkGitInstalled();

			const spinner = ora("Fetching MCPs...").start();

			// Find MCP by name
			const mcps = await api.get<McpRepositoryListResponse>(
				"/api/mcp/repositories",
			);
			const mcp = mcps.find((m: McpRepository) => m.name === name);

			if (!mcp) {
				spinner.fail("MCP not found");
				throw new McpError(
					`MCP "${name}" not found. Run 'waniwani mcp list' to see available MCPs.`,
				);
			}

			// Get authenticated clone URL
			spinner.text = "Cloning repository...";
			const { cloneUrl } = await api.get<CloneUrlResponse>(
				`/api/mcp/repositories/${mcp.id}/clone-url`,
			);

			// Clone the repository
			try {
				execSync(`git clone "${cloneUrl}" "${projectDir}"`, {
					stdio: "ignore",
				});
			} catch {
				spinner.fail("Failed to clone repository");
				throw new CLIError(
					"Failed to clone repository. Ensure git is configured correctly.",
					"CLONE_FAILED",
				);
			}

			// Create .waniwani/settings.json with mcpId
			const parentConfig = await loadParentConfig(cwd);
			await initConfigAt(projectDir, {
				...parentConfig,
				mcpId: mcp.id,
			});

			spinner.succeed("Repository cloned");

			if (json) {
				formatOutput(
					{
						success: true,
						projectDir,
						mcpId: mcp.id,
					},
					true,
				);
			} else {
				console.log();
				formatSuccess(`MCP "${name}" cloned!`, false);
				console.log();
				console.log("Next steps:");
				console.log(`  cd ${dirName}`);
				console.log("  waniwani mcp preview      # Start developing");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
