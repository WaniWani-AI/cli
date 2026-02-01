import { existsSync, mkdirSync } from "node:fs";
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
import { handleError } from "../../lib/errors.js";
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

export const initCommand = new Command("init")
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

			// Create repository on backend (GitHub repo created immediately)
			const spinner = ora("Creating MCP...").start();

			const result = await api.post<McpRepository>("/api/mcp/repositories", {
				name,
			});

			// Create local project directory
			mkdirSync(projectDir, { recursive: true });

			// Create .waniwani/settings.json with mcpId
			const parentConfig = await loadParentConfig(cwd);
			await initConfigAt(projectDir, {
				...parentConfig,
				mcpId: result.id,
			});

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
				console.log("  waniwani mcp sync     # Pull template files");
				console.log("  waniwani mcp dev      # Start developing");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
