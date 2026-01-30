import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { handleError } from "../lib/errors.js";
import { formatOutput, formatSuccess } from "../lib/output.js";
import { pullFilesFromSandbox } from "../lib/sync.js";
import type { CreateMcpResponse } from "../types/index.js";

const PROJECT_CONFIG_DIR = ".waniwani";
const PROJECT_CONFIG_FILE = "settings.json";

const DEFAULT_PROJECT_CONFIG = {
	defaults: {
		model: "claude-sonnet-4-20250514",
		maxSteps: 10,
	},
};

/**
 * Load parent .waniwani/settings.json if it exists
 */
async function loadParentConfig(
	cwd: string,
): Promise<Record<string, unknown> | null> {
	const parentConfigPath = join(cwd, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
	if (!existsSync(parentConfigPath)) {
		return null;
	}

	try {
		const content = await readFile(parentConfigPath, "utf-8");
		const config = JSON.parse(content);
		// Remove mcpId from parent - the new project gets its own
		const { mcpId: _, ...rest } = config;
		return rest;
	} catch {
		return null;
	}
}

export const initCommand = new Command("init")
	.description("Create a new MCP project from template")
	.argument("<name>", "Name for the MCP project")
	.action(async (name: string, _, command) => {
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

			// Create sandbox on backend (API pushes template files to sandbox)
			const spinner = ora("Creating MCP sandbox...").start();

			const result = await api.post<CreateMcpResponse>("/api/mcp/sandboxes", {
				name,
			});

			spinner.text = "Downloading template files...";

			// Create project directory
			await mkdir(projectDir, { recursive: true });

			// Pull template files from sandbox to local directory
			await pullFilesFromSandbox(result.id, projectDir);

			spinner.text = "Setting up project config...";

			// Create .waniwani/settings.json with mcpId
			// Inherit settings from parent .waniwani if it exists
			const configDir = join(projectDir, PROJECT_CONFIG_DIR);
			const configPath = join(configDir, PROJECT_CONFIG_FILE);

			await mkdir(configDir, { recursive: true });

			const parentConfig = await loadParentConfig(cwd);
			const projectConfig = {
				...DEFAULT_PROJECT_CONFIG,
				...parentConfig,
				mcpId: result.id, // Always use the new sandbox's mcpId
			};

			await writeFile(
				configPath,
				JSON.stringify(projectConfig, null, "\t"),
				"utf-8",
			);

			spinner.succeed("MCP project created");

			if (json) {
				formatOutput(
					{
						success: true,
						projectDir,
						mcpId: result.id,
						sandboxId: result.sandboxId,
						previewUrl: result.previewUrl,
					},
					true,
				);
			} else {
				console.log();
				formatSuccess(`MCP project "${name}" created!`, false);
				console.log();
				console.log(`  Project:     ${projectDir}`);
				console.log(`  MCP ID:      ${result.id}`);
				console.log(`  Preview URL: ${result.previewUrl}`);
				console.log();
				console.log("Next steps:");
				console.log(`  cd ${name}`);
				console.log("  waniwani push         # Sync files to sandbox");
				console.log("  waniwani dev          # Watch mode with auto-sync");
				console.log('  waniwani task "..."   # Send tasks to Claude');
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
