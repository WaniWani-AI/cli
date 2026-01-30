import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import {
	CONFIG_FILE_NAME,
	initConfigAt,
	LOCAL_CONFIG_DIR,
} from "../lib/config.js";
import { handleError } from "../lib/errors.js";
import { formatOutput, formatSuccess } from "../lib/output.js";
import { pullFilesFromSandbox } from "../lib/sync.js";
import type { CreateMcpResponse } from "../types/index.js";

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
			const parentConfig = await loadParentConfig(cwd);
			await initConfigAt(projectDir, {
				...parentConfig,
				mcpId: result.id, // Always use the new sandbox's mcpId
			});

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
