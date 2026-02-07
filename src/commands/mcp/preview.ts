import { watch } from "chokidar";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { CLIError, handleError } from "../../lib/errors.js";
import { formatSuccess } from "../../lib/output.js";
import {
	collectFiles,
	collectSingleFile,
	findProjectRoot,
	loadIgnorePatterns,
} from "../../lib/sync.js";
import type {
	McpSandbox,
	SandboxStartResponse,
	WriteFilesResponse,
} from "../../types/index.js";

export const previewCommand = new Command("preview")
	.description("Start live development with sandbox and file watching")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("--no-watch", "Skip file watching")
	.option("--no-logs", "Don't stream logs to terminal")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			// Find project root and MCP ID
			const projectRoot = await findProjectRoot(process.cwd());
			if (!projectRoot) {
				throw new CLIError(
					"Not in a WaniWani project. Run 'waniwani mcp create <name>' first.",
					"NOT_IN_PROJECT",
				);
			}

			let mcpId = options.mcpId;
			if (!mcpId) {
				mcpId = await config.getMcpId();
			}
			if (!mcpId) {
				throw new CLIError(
					"No MCP found. Run 'waniwani mcp create <name>' or use --mcp-id.",
					"NO_MCP",
				);
			}

			const spinner = ora("Starting development environment...").start();

			// Step 1: Create or get session (this also starts the sandbox)
			spinner.text = "Starting session...";
			let sessionId: string;
			let previewUrl: string;
			try {
				const sessionResponse = await api.post<SandboxStartResponse>(
					`/api/mcp/repositories/${mcpId}/session`,
					{},
				);
				sessionId = sessionResponse.sandbox.id;
				previewUrl = sessionResponse.previewUrl;
			} catch {
				// Session might already exist, try to get it
				const existing = await api.get<McpSandbox | null>(
					`/api/mcp/repositories/${mcpId}/session`,
				);
				if (!existing) {
					throw new CLIError("Failed to start session", "SESSION_ERROR");
				}
				sessionId = existing.id;
				previewUrl = existing.previewUrl;
			}

			// Store session ID in config
			await config.setSessionId(sessionId);

			// Step 2: Sync current files to sandbox
			spinner.text = "Syncing files to sandbox...";
			const files = await collectFiles(projectRoot);
			if (files.length > 0) {
				await api.post<WriteFilesResponse>(
					`/api/mcp/sessions/${sessionId}/files`,
					{ files },
				);
			}

			spinner.succeed("Development environment ready");

			console.log();
			formatSuccess("Live preview started!", false);
			console.log();
			console.log(`  Preview URL: ${previewUrl}`);
			console.log();
			console.log(`  MCP Inspector:`);
			console.log(
				`    npx @anthropic-ai/mcp-inspector@latest "${previewUrl}/mcp"`,
			);
			console.log();

			if (options.watch !== false) {
				console.log("Watching for file changes... (Ctrl+C to stop)");
				console.log();

				// Step 4: Start file watcher
				const ig = await loadIgnorePatterns(projectRoot);

				const watcher = watch(projectRoot, {
					ignored: (path) => {
						// Get relative path from project root
						const relative = path.replace(`${projectRoot}/`, "");
						if (relative === path) return false; // Don't ignore the root
						return ig.ignores(relative);
					},
					persistent: true,
					ignoreInitial: true,
					awaitWriteFinish: {
						stabilityThreshold: 100,
						pollInterval: 50,
					},
				});

				const syncFile = async (filePath: string) => {
					const relativePath = filePath.replace(`${projectRoot}/`, "");
					const file = await collectSingleFile(projectRoot, relativePath);
					if (file) {
						try {
							await api.post<WriteFilesResponse>(
								`/api/mcp/sessions/${sessionId}/files`,
								{ files: [file] },
							);
							console.log(`  Synced: ${relativePath}`);
						} catch {
							console.error(`  Failed to sync: ${relativePath}`);
						}
					}
				};

				watcher.on("add", syncFile);
				watcher.on("change", syncFile);
				watcher.on("unlink", (filePath) => {
					const relativePath = filePath.replace(`${projectRoot}/`, "");
					console.log(`  Deleted: ${relativePath}`);
				});

				// Handle Ctrl+C gracefully
				process.on("SIGINT", async () => {
					console.log();
					console.log("Stopping development environment...");
					await watcher.close();
					process.exit(0);
				});

				// Keep the process running
				await new Promise(() => {});
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
