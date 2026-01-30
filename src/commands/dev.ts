import { relative } from "node:path";
import chalk from "chalk";
import chokidar from "chokidar";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { CLIError, handleError } from "../lib/errors.js";
import {
	collectFiles,
	collectSingleFile,
	findProjectRoot,
	loadIgnorePatterns,
	loadProjectMcpId,
} from "../lib/sync.js";
import { debounce } from "../lib/utils.js";
import type { WriteFilesResponse } from "../types/index.js";

const BATCH_SIZE = 50;
const DEFAULT_DEBOUNCE_MS = 300;

export const devCommand = new Command("dev")
	.description("Watch and sync files to MCP sandbox")
	.option("--no-initial-sync", "Skip initial sync of all files")
	.option(
		"--debounce <ms>",
		"Debounce delay in milliseconds",
		String(DEFAULT_DEBOUNCE_MS),
	)
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

			// Initial sync if not disabled
			if (options.initialSync !== false) {
				const spinner = ora("Initial sync...").start();
				const files = await collectFiles(projectRoot);

				if (files.length > 0) {
					const totalBatches = Math.ceil(files.length / BATCH_SIZE);
					let synced = 0;

					for (let i = 0; i < totalBatches; i++) {
						const batch = files.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
						spinner.text = `Syncing (${i + 1}/${totalBatches})...`;

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
						synced += result.written.length;
					}

					spinner.succeed(`Initial sync complete (${synced} files)`);
				} else {
					spinner.info("No files to sync");
				}
			}

			// Load ignore patterns for watcher
			const ig = await loadIgnorePatterns(projectRoot);

			// Set up debounced sync function
			const debounceMs =
				Number.parseInt(options.debounce, 10) || DEFAULT_DEBOUNCE_MS;

			const syncFile = debounce(async (filePath: string) => {
				const relativePath = relative(projectRoot, filePath);

				// Check if file should be ignored
				if (ig.ignores(relativePath)) {
					return;
				}

				const file = await collectSingleFile(projectRoot, relativePath);
				if (!file) {
					console.log(chalk.yellow("Skipped:"), relativePath);
					return;
				}

				try {
					await api.post<WriteFilesResponse>(
						`/api/mcp/sandboxes/${mcpId}/files`,
						{
							files: [
								{
									path: file.path,
									content: file.content,
									encoding: file.encoding,
								},
							],
						},
					);
					console.log(chalk.green("Synced:"), relativePath);
				} catch (error) {
					console.log(chalk.red("Failed:"), relativePath);
					if (globalOptions.verbose) {
						console.error(error);
					}
				}
			}, debounceMs);

			// Start watcher
			console.log();
			console.log(chalk.bold("Watching for changes..."));
			console.log(chalk.dim("Press Ctrl+C to stop"));
			console.log();

			const watcher = chokidar.watch(projectRoot, {
				ignored: (path: string) => {
					const relativePath = relative(projectRoot, path);
					return ig.ignores(relativePath);
				},
				persistent: true,
				ignoreInitial: true,
				awaitWriteFinish: {
					stabilityThreshold: 100,
					pollInterval: 100,
				},
			});

			watcher
				.on("add", (path) => syncFile(path))
				.on("change", (path) => syncFile(path))
				.on("unlink", (path) => {
					const relativePath = relative(projectRoot, path);
					console.log(chalk.yellow("Deleted (local only):"), relativePath);
				});

			// Handle graceful shutdown
			const cleanup = () => {
				console.log();
				console.log(chalk.dim("Stopping watcher..."));
				watcher.close().then(() => {
					process.exit(0);
				});
			};

			process.on("SIGINT", cleanup);
			process.on("SIGTERM", cleanup);
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
