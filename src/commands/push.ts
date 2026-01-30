import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { CLIError, handleError } from "../lib/errors.js";
import { formatOutput, formatSuccess } from "../lib/output.js";
import {
	collectFiles,
	findProjectRoot,
	loadProjectMcpId,
} from "../lib/sync.js";
import type { WriteFilesResponse } from "../types/index.js";

const BATCH_SIZE = 50;

export const pushCommand = new Command("push")
	.description("Sync local files to MCP sandbox")
	.option("--dry-run", "Show what would be synced without uploading")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const cwd = process.cwd();

			// Find project root
			const projectRoot = await findProjectRoot(cwd);
			if (!projectRoot) {
				throw new CLIError(
					"Not in a WaniWani project. Run 'waniwani init <name>' first.",
					"NOT_IN_PROJECT",
				);
			}

			// Load MCP ID
			const mcpId = await loadProjectMcpId(projectRoot);
			if (!mcpId) {
				throw new CLIError(
					"No MCP ID found in project config. Run 'waniwani init <name>' first.",
					"NO_MCP_ID",
				);
			}

			// Collect files
			const spinner = ora("Collecting files...").start();
			const files = await collectFiles(projectRoot);

			if (files.length === 0) {
				spinner.info("No files to sync");
				if (json) {
					formatOutput({ synced: 0, files: [] }, true);
				}
				return;
			}

			spinner.text = `Found ${files.length} files`;

			if (options.dryRun) {
				spinner.stop();
				console.log();
				console.log(chalk.bold("Files that would be synced:"));
				for (const file of files) {
					console.log(`  ${file.path}`);
				}
				console.log();
				console.log(`Total: ${files.length} files`);
				return;
			}

			// Sync files in batches
			const allWritten: string[] = [];
			const totalBatches = Math.ceil(files.length / BATCH_SIZE);

			for (let i = 0; i < totalBatches; i++) {
				const batch = files.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
				spinner.text = `Syncing files (${i + 1}/${totalBatches})...`;

				const result = await api.post<WriteFilesResponse>(
					`/api/mcp/sandboxes/${mcpId}/files`,
					{
						files: batch.map((f) => ({
							path: f.path,
							content: f.content,
							encoding: f.encoding,
						})),
					},
				);

				allWritten.push(...result.written);
			}

			spinner.succeed(`Synced ${allWritten.length} files`);

			if (json) {
				formatOutput(
					{
						synced: allWritten.length,
						files: allWritten,
					},
					true,
				);
			} else {
				console.log();
				formatSuccess(`${allWritten.length} files synced to sandbox`, false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
