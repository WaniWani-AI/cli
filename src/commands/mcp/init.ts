import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { execa } from "execa";
import ora from "ora";
import { api } from "../../lib/api.js";
import {
	CONFIG_FILE_NAME,
	initConfigAt,
	LOCAL_CONFIG_DIR,
} from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type { CreateMcpRepositoryResponse } from "../../types/index.js";

/**
 * Load parent .waniwani/settings.json if it exists
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
		// Remove mcp from parent - the new project gets its own
		const { mcp: _, ...rest } = config;
		return rest;
	} catch {
		return null;
	}
}

export const initCommand = new Command("init")
	.description("Create a new MCP project")
	.argument("<name>", "Name for the MCP project")
	.option("--no-clone", "Skip automatic git clone (just output the command)")
	.action(async (name: string, options, command) => {
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

			const result = await api.post<CreateMcpRepositoryResponse>(
				"/api/mcp/repositories",
				{ name },
			);

			if (options.clone !== false) {
				spinner.text = "Cloning repository...";

				// Clone using git
				await execa("git", ["clone", result.cloneUrl, name], { cwd });

				spinner.text = "Setting up project config...";

				// Create .waniwani/settings.json with mcp info
				const parentConfig = await loadParentConfig(cwd);
				await initConfigAt(projectDir, {
					...parentConfig,
					mcp: {
						id: result.repository.id,
						name: result.repository.name,
					},
				});

				spinner.succeed("MCP project created");
			} else {
				spinner.succeed("MCP created");
			}

			if (json) {
				formatOutput(
					{
						success: true,
						projectDir: options.clone !== false ? projectDir : null,
						mcpId: result.repository.id,
					},
					true,
				);
			} else {
				console.log();
				formatSuccess(`MCP "${name}" created!`, false);
				console.log();

				if (options.clone !== false) {
					console.log("Next steps:");
					console.log(`  cd ${name}`);
					console.log(
						"  waniwani mcp dev      # Start live preview with file watching",
					);
					console.log("  waniwani mcp push     # Deploy to production");
				} else {
					console.log("Clone your repository:");
					console.log(`  ${result.cloneCommand}`);
					console.log(`  cd ${name}`);
					console.log();
					console.log("Then start developing:");
					console.log(
						"  waniwani mcp dev      # Start live preview with file watching",
					);
					console.log("  waniwani mcp push     # Deploy to production");
				}
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
