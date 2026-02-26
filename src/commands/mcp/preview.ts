import { existsSync } from "node:fs";
import { join } from "node:path";
import { watch } from "chokidar";
import { Command, InvalidArgumentError } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { withTimeout } from "../../lib/async.js";
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
	RunCommandResponse,
	SandboxStartResponse,
	ServerStartResponse,
	ServerStatusResponse,
	WriteFilesResponse,
} from "../../types/index.js";

const SHUTDOWN_MAX_WAIT_MS = 3000;
const SHUTDOWN_STEP_TIMEOUT_MS = 1200;
const DEV_SERVER_VERIFY_ATTEMPTS = 4;
const DEV_SERVER_VERIFY_INTERVAL_MS = 750;
const DEFAULT_DEV_SERVER_MONITOR_INTERVAL_MS = 60000;

type SessionInfo = {
	id: string;
	previewUrl: string;
	sandboxId?: string;
};

type CommandStatusResponse = {
	cmdId: string;
	exitCode: number | null;
	running: boolean;
};

type CommandOutputResponse = {
	cmdId: string;
	exitCode: number | null;
	stdout: string;
	stderr: string;
};

type PackageManager = "bun" | "pnpm" | "yarn" | "npm-ci" | "npm";

const MAX_INSTALL_TIMEOUT_MS = 300000;

function resolveSessionInfo(
	response:
		| SandboxStartResponse
		| McpSandbox
		| (McpSandbox & { sandbox?: McpSandbox }),
): SessionInfo {
	// Legacy shape: { sandbox: {...}, previewUrl }
	const maybeLegacy = response as SandboxStartResponse;
	if (maybeLegacy?.sandbox?.id && maybeLegacy?.previewUrl) {
		return {
			id: maybeLegacy.sandbox.id,
			previewUrl: maybeLegacy.previewUrl,
			sandboxId: maybeLegacy.sandbox.sandboxId,
		};
	}

	// Current shape: session object itself
	const maybeSession = response as McpSandbox;
	if (maybeSession?.id && maybeSession?.previewUrl) {
		return {
			id: maybeSession.id,
			previewUrl: maybeSession.previewUrl,
			sandboxId: maybeSession.sandboxId,
		};
	}

	throw new CLIError("Invalid session response from API", "SESSION_ERROR");
}

function detectPackageManager(projectRoot: string): PackageManager {
	if (
		existsSync(join(projectRoot, "bun.lock")) ||
		existsSync(join(projectRoot, "bun.lockb"))
	) {
		return "bun";
	}
	if (existsSync(join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(projectRoot, "yarn.lock"))) return "yarn";
	if (
		existsSync(join(projectRoot, "package-lock.json")) ||
		existsSync(join(projectRoot, "npm-shrinkwrap.json"))
	) {
		return "npm-ci";
	}
	return "npm";
}

function getInstallCommand(pm: PackageManager): {
	command: string;
	args: string[];
} {
	switch (pm) {
		case "bun":
			return { command: "bun", args: ["install", "--frozen-lockfile"] };
		case "pnpm":
			return {
				command: "pnpm",
				args: ["install", "--frozen-lockfile", "--prefer-offline"],
			};
		case "yarn":
			return {
				command: "yarn",
				args: ["install", "--frozen-lockfile", "--prefer-offline"],
			};
		case "npm-ci":
			return {
				command: "npm",
				args: ["ci", "--no-audit", "--no-fund", "--prefer-offline"],
			};
		default:
			return {
				command: "npm",
				args: ["install", "--no-audit", "--no-fund"],
			};
	}
}

function getNonFrozenInstallCommand(pm: PackageManager): {
	command: string;
	args: string[];
} | null {
	switch (pm) {
		case "bun":
			return { command: "bun", args: ["install"] };
		case "pnpm":
			return { command: "pnpm", args: ["install", "--prefer-offline"] };
		case "yarn":
			return { command: "yarn", args: ["install", "--prefer-offline"] };
		case "npm-ci":
			return { command: "npm", args: ["install", "--no-audit", "--no-fund"] };
		default:
			return null;
	}
}

function shouldRetryWithoutFrozenLockfile(result: RunCommandResponse): boolean {
	const output = `${result.stderr}\n${result.stdout}`.toLowerCase();
	const npmLockMismatchDetected =
		(output.includes("update your lock file") &&
			output.includes("npm install")) ||
		(output.includes("package-lock.json") && output.includes("not in sync")) ||
		(output.includes("package-lock.json") &&
			output.includes("are not in sync")) ||
		(output.includes("npm ci") &&
			output.includes("can only install packages") &&
			output.includes("package-lock.json"));

	return (
		output.includes("frozen-lockfile") ||
		output.includes("lockfile had changes") ||
		output.includes("lockfile is frozen") ||
		(output.includes("lockfile") && output.includes("out of date")) ||
		npmLockMismatchDetected
	);
}

function isAlreadyRunningServerError(error: unknown): boolean {
	const normalized = getNormalizedError(error);
	return (
		normalized.includes("already_running") ||
		normalized.includes("already running")
	);
}

function isServerNotRunningError(error: unknown): boolean {
	const normalized = getNormalizedError(error);
	return (
		normalized.includes("server_not_running") ||
		normalized.includes("server not running")
	);
}

function getNormalizedError(error: unknown): string {
	if (!(error instanceof CLIError)) return "";
	const details = JSON.stringify(error.details ?? {}).toLowerCase();
	return `${error.code} ${error.message} ${details}`.toLowerCase();
}

async function getServerStatusOrNull(
	sessionId: string,
): Promise<ServerStatusResponse | null> {
	try {
		return await api.get<ServerStatusResponse>(
			`/api/mcp/sessions/${sessionId}/server`,
		);
	} catch (error) {
		if (isServerNotRunningError(error)) {
			return null;
		}
		throw error;
	}
}

function getDevCommand(pm: PackageManager): string {
	switch (pm) {
		case "bun":
			return "bun run dev";
		case "pnpm":
			return "pnpm run dev";
		case "yarn":
			return "yarn run dev";
		default:
			return "npm run dev";
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function parseStatusPollIntervalMs(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 500) {
		throw new InvalidArgumentError(
			"Status poll interval must be an integer >= 500 milliseconds.",
		);
	}
	return parsed;
}

async function getCommandOutputOrNull(
	sessionId: string,
	cmdId: string,
): Promise<CommandOutputResponse | null> {
	try {
		return await api.get<CommandOutputResponse>(
			`/api/mcp/sessions/${sessionId}/commands/${cmdId}`,
		);
	} catch {
		return null;
	}
}

async function cleanupPreviewSession(sessionId: string): Promise<void> {
	await withTimeout(
		api
			.post(`/api/mcp/sessions/${sessionId}/server`, { action: "stop" })
			.catch(() => undefined),
		SHUTDOWN_STEP_TIMEOUT_MS,
	);

	await withTimeout(
		api.delete(`/api/mcp/sessions/${sessionId}`).catch(() => undefined),
		SHUTDOWN_STEP_TIMEOUT_MS,
	);

	await withTimeout(
		config.setSessionId(null).catch(() => undefined),
		SHUTDOWN_STEP_TIMEOUT_MS,
	);
}

export const previewCommand = new Command("preview")
	.description("Start live development with sandbox and file watching")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("--no-watch", "Skip file watching")
	.option("--no-logs", "Don't stream logs to terminal")
	.option(
		"--status-poll-interval-ms <ms>",
		"Watch-mode server status polling interval in milliseconds (default: 60000)",
		parseStatusPollIntervalMs,
		DEFAULT_DEV_SERVER_MONITOR_INTERVAL_MS,
	)
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;
		const statusPollIntervalMs =
			options.statusPollIntervalMs ?? DEFAULT_DEV_SERVER_MONITOR_INTERVAL_MS;

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
			let sandboxId: string | undefined;
			try {
				const sessionResponse = await api.post<SandboxStartResponse>(
					`/api/mcp/repositories/${mcpId}/session`,
					{},
				);
				const sessionInfo = resolveSessionInfo(sessionResponse);
				sessionId = sessionInfo.id;
				previewUrl = sessionInfo.previewUrl;
				sandboxId = sessionInfo.sandboxId;
			} catch {
				// Session might already exist, try to get it
				const existing = await api.get<McpSandbox | null>(
					`/api/mcp/repositories/${mcpId}/session`,
				);
				if (!existing) {
					throw new CLIError("Failed to start session", "SESSION_ERROR");
				}
				const sessionInfo = resolveSessionInfo(existing);
				sessionId = sessionInfo.id;
				previewUrl = sessionInfo.previewUrl;
				sandboxId = sessionInfo.sandboxId;
			}

			// Store session ID in config
			await config.setSessionId(sessionId);

			// Step 2: Sync current files to sandbox (CLI-driven hydration)
			spinner.text = "Syncing files to sandbox...";
			const files = await collectFiles(projectRoot, { includeEnvFiles: true });
			if (files.length > 0) {
				await api.post<WriteFilesResponse>(
					`/api/mcp/sessions/${sessionId}/files`,
					{ files },
				);
			}

			// Step 3: Install dependencies to match local state
			const packageManager = detectPackageManager(projectRoot);
			let installCommand = getInstallCommand(packageManager);
			spinner.text = `Installing dependencies (${installCommand.command})...`;
			let installResult = await api.post<RunCommandResponse>(
				`/api/mcp/sessions/${sessionId}/commands`,
				{
					command: installCommand.command,
					args: installCommand.args,
					timeout: MAX_INSTALL_TIMEOUT_MS,
				},
			);

			if (installResult.exitCode !== 0) {
				const nonFrozenInstallCommand =
					getNonFrozenInstallCommand(packageManager);
				if (
					nonFrozenInstallCommand &&
					shouldRetryWithoutFrozenLockfile(installResult)
				) {
					installCommand = nonFrozenInstallCommand;
					spinner.text = `Retrying install without frozen lockfile (${installCommand.command})...`;
					installResult = await api.post<RunCommandResponse>(
						`/api/mcp/sessions/${sessionId}/commands`,
						{
							command: installCommand.command,
							args: installCommand.args,
							timeout: MAX_INSTALL_TIMEOUT_MS,
						},
					);
				}
			}

			if (installResult.exitCode !== 0) {
				throw new CLIError(
					installResult.stderr ||
						`Dependency install failed with exit code ${installResult.exitCode}`,
					"SANDBOX_HYDRATION_FAILED",
					{
						command: [installCommand.command, ...installCommand.args].join(" "),
						exitCode: installResult.exitCode,
					},
				);
			}

			// Step 4: Start server with package-manager-aware dev command
			const devCommand = getDevCommand(packageManager);
			let serverCmdId: string | undefined;
			let didStartServer = false;

			const serverStatus = await getServerStatusOrNull(sessionId);
			const serverStatusPreviewUrl = serverStatus?.previewUrl;
			if (serverStatusPreviewUrl) {
				previewUrl = serverStatusPreviewUrl;
			}

			if (serverStatus?.running) {
				spinner.text = "Server already running, attaching...";
				serverCmdId = serverStatus.cmdId;
			} else {
				spinner.text = `Starting server (${devCommand})...`;
				try {
					const serverStart = await api.post<ServerStartResponse>(
						`/api/mcp/sessions/${sessionId}/server`,
						{
							action: "start",
							command: devCommand,
						},
					);
					const serverStartPreviewUrl = serverStart.previewUrl;
					if (serverStartPreviewUrl) {
						previewUrl = serverStartPreviewUrl;
					}
					serverCmdId = serverStart.cmdId;
					didStartServer = true;
				} catch (error) {
					if (!isAlreadyRunningServerError(error)) {
						throw error;
					}

					const refreshedStatus = await getServerStatusOrNull(sessionId);
					if (!refreshedStatus?.running) {
						throw error;
					}

					const refreshedPreviewUrl = refreshedStatus.previewUrl;
					if (refreshedPreviewUrl) {
						previewUrl = refreshedPreviewUrl;
					}
					serverCmdId = refreshedStatus.cmdId;
					spinner.text = "Server already running, attaching...";
				}
			}

			if (didStartServer && !serverCmdId) {
				await cleanupPreviewSession(sessionId);
				throw new CLIError(
					"Server start command ID was not returned by the API.",
					"SERVER_START_FAILED",
					{ command: devCommand },
				);
			}

			if (didStartServer && serverCmdId) {
				spinner.text = "Verifying server startup...";
				for (let attempt = 0; attempt < DEV_SERVER_VERIFY_ATTEMPTS; attempt++) {
					if (attempt > 0) {
						await sleep(DEV_SERVER_VERIFY_INTERVAL_MS);
					}

					const commandStatus = await api.get<CommandStatusResponse>(
						`/api/mcp/sessions/${sessionId}/commands/${serverCmdId}?statusOnly=true`,
					);

					if (commandStatus.exitCode === null) {
						continue;
					}

					const commandOutput = await api
						.get<CommandOutputResponse>(
							`/api/mcp/sessions/${sessionId}/commands/${serverCmdId}`,
						)
						.catch(() => null);

					await cleanupPreviewSession(sessionId);
					throw new CLIError(
						`Dev server command exited during startup with code ${commandStatus.exitCode}.`,
						"SERVER_START_FAILED",
						{
							command: devCommand,
							cmdId: serverCmdId,
							exitCode: commandStatus.exitCode,
							stdout: commandOutput?.stdout ?? "",
							stderr: commandOutput?.stderr ?? "",
						},
					);
				}
			}

			spinner.succeed("Development environment ready");

			console.log();
			formatSuccess("Live preview started!", false);
			console.log();
			if (sandboxId) {
				console.log(`  Sandbox ID: ${sandboxId}`);
			}
			console.log(`  Preview URL: ${previewUrl}`);
			console.log();
			console.log(`  MCP Inspector:`);
			console.log(
				`    npx @modelcontextprotocol/inspector@latest --transport http --server-url "${previewUrl}/mcp"`,
			);
			console.log();

			if (options.watch !== false) {
				console.log("Watching for file changes... (Ctrl+C to stop)");
				console.log();

				// Step 5: Start file watcher
				const ig = await loadIgnorePatterns(projectRoot, {
					includeEnvFiles: true,
				});

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

				let shuttingDown = false;
				let serverMonitorInterval: NodeJS.Timeout | null = null;
				const gracefulShutdown = async (exitCode = 0) => {
					if (shuttingDown) return;
					shuttingDown = true;
					if (serverMonitorInterval) {
						clearInterval(serverMonitorInterval);
						serverMonitorInterval = null;
					}

					console.log();
					console.log("Stopping development environment...");

					try {
						await withTimeout(
							(async () => {
								await withTimeout(
									watcher.close().catch(() => undefined),
									SHUTDOWN_STEP_TIMEOUT_MS,
								);
								await cleanupPreviewSession(sessionId);
							})(),
							SHUTDOWN_MAX_WAIT_MS,
							{
								onTimeout: () => {
									console.log("Shutdown timed out, forcing exit.");
								},
							},
						);
					} finally {
						process.exit(exitCode);
					}
				};

				if (serverCmdId) {
					serverMonitorInterval = setInterval(() => {
						if (shuttingDown) return;
						void (async () => {
							try {
								const commandStatus = await api.get<CommandStatusResponse>(
									`/api/mcp/sessions/${sessionId}/commands/${serverCmdId}?statusOnly=true`,
								);
								if (commandStatus.exitCode === null) {
									return;
								}

								if (commandStatus.exitCode === 0) {
									console.log("Dev server exited (code 0).");
									await gracefulShutdown(0);
									return;
								}

								const commandOutput = await getCommandOutputOrNull(
									sessionId,
									serverCmdId,
								);
								handleError(
									new CLIError(
										`Dev server exited with code ${commandStatus.exitCode}.`,
										"SERVER_EXITED",
										{
											command: devCommand,
											cmdId: serverCmdId,
											exitCode: commandStatus.exitCode,
											stdout: commandOutput?.stdout ?? "",
											stderr: commandOutput?.stderr ?? "",
										},
									),
									json,
								);
								await gracefulShutdown(1);
							} catch {
								// Ignore transient polling errors while watch loop is active.
							}
						})();
					}, statusPollIntervalMs);
				}

				// Handle graceful process termination.
				process.once("SIGINT", () => {
					void gracefulShutdown();
				});
				process.once("SIGTERM", () => {
					void gracefulShutdown();
				});

				// Keep the process running
				await new Promise(() => {});
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
