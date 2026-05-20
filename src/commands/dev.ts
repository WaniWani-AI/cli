import { type ChildProcess, spawn } from "node:child_process";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { openBrowser } from "../lib/browser.js";
import { config } from "../lib/config.js";
import { devSessionApi } from "../lib/dev-session.js";
import { CLIError, handleError } from "../lib/errors.js";
import {
	detectPackageManager,
	type PackageManager,
	devCommand as packageManagerDevCommand,
} from "../lib/package-manager.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { runConnectFlow } from "./connect.js";
import { ensureLoggedIn } from "./login.js";

const HEARTBEAT_INTERVAL_MS = 30_000;
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_POLL_MS = 500;
const CLEANUP_DELETE_TIMEOUT_MS = 2_000;

function parsePort(raw: string): number {
	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new CLIError(
			`Invalid port: ${raw}. Must be an integer between 1 and 65535.`,
			"INVALID_PORT",
		);
	}
	return port;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await fetch(url);
			return; // Any response — the server is bound to the port.
		} catch {
			await new Promise((resolve) => setTimeout(resolve, READINESS_POLL_MS));
		}
	}
	throw new CLIError(
		`Local server did not respond on ${url} within ${timeoutMs / 1000}s. Make sure your dev script binds to PORT=${new URL(url).port}.`,
		"MCP_NOT_READY",
	);
}

function printDevStatus(opts: {
	port: number;
	localUrl: string;
	playgroundUrl: string;
	packageManager: PackageManager;
}): void {
	console.log();
	console.log(chalk.bold("WaniWani local dev"));
	console.log(`  Local server: ${chalk.cyan(opts.localUrl)}`);
	console.log(`  Playground:   ${chalk.cyan(opts.playgroundUrl)}`);
	console.log(`  Package mgr:  ${chalk.gray(opts.packageManager)}`);
	console.log();
	console.log(chalk.gray("Press Ctrl-C to stop."));
	console.log();
}

export const devCommand = new Command("dev")
	.description("Run your MCP locally and connect it to the WaniWani playground")
	.option("-p, --port <port>", "Local port the MCP listens on", parsePort)
	.action(async (options, command) => {
		const json = command.optsWithGlobals().json ?? false;

		let child: ChildProcess | null = null;
		let heartbeatTimer: NodeJS.Timeout | null = null;
		let sessionId: string | null = null;
		let projectIdForCleanup: string | null = null;
		let cleanedUp = false;

		const cleanup = async (code: number): Promise<void> => {
			if (cleanedUp) return;
			cleanedUp = true;

			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
				heartbeatTimer = null;
			}

			if (sessionId && projectIdForCleanup) {
				await Promise.race([
					devSessionApi.delete(projectIdForCleanup, sessionId).catch(() => {}),
					new Promise((r) => setTimeout(r, CLEANUP_DELETE_TIMEOUT_MS)),
				]);
			}

			if (child && !child.killed) {
				child.kill("SIGTERM");
			}

			process.exit(code);
		};

		process.on("SIGINT", () => {
			void cleanup(0);
		});
		process.on("SIGTERM", () => {
			void cleanup(0);
		});

		try {
			if (json) {
				throw new CLIError(
					"`waniwani dev` is interactive only. Run it without --json.",
					"INTERACTIVE_REQUIRED",
				);
			}

			await ensureLoggedIn();

			const existing = await loadProjectConfig();
			let projectId: string;
			if (existing?.projectId) {
				projectId = existing.projectId;
			} else {
				console.log(chalk.gray("No project linked. Setting one up..."));
				console.log();
				const result = await runConnectFlow();
				projectId = result.project.id;
			}
			projectIdForCleanup = projectId;

			const port = options.port ?? existing?.devPort ?? 3000;
			const localUrl = `http://localhost:${port}`;

			const cwd = process.cwd();
			const pm = detectPackageManager(cwd);
			const [cmd, args] = packageManagerDevCommand(pm);

			console.log(
				chalk.gray(
					`Starting your MCP with: ${cmd} ${args.join(" ")} (PORT=${port})`,
				),
			);
			console.log();

			child = spawn(cmd, args, {
				stdio: "inherit",
				env: { ...process.env, PORT: String(port) },
			});

			child.on("exit", (code) => {
				void cleanup(code ?? 0);
			});
			child.on("error", (err) => {
				console.error(chalk.red(`\nFailed to start ${cmd}: ${err.message}`));
				void cleanup(1);
			});

			const spinner = ora(
				`Waiting for local server on port ${port}...`,
			).start();
			try {
				await waitForServer(localUrl, READINESS_TIMEOUT_MS);
				spinner.succeed(`Local server ready on port ${port}`);
			} catch (err) {
				spinner.fail(`Local server did not start on port ${port}`);
				throw err;
			}

			const session = await devSessionApi.create(projectId, localUrl);
			sessionId = session.id;

			heartbeatTimer = setInterval(() => {
				devSessionApi.heartbeat(projectId, session.id).catch(() => {
					// Best-effort; log nothing to avoid noise. If the session is
					// genuinely gone, the playground will fall back to production.
				});
			}, HEARTBEAT_INTERVAL_MS);

			const apiUrl = await config.getApiUrl();
			const playgroundUrl = `${apiUrl}/agents/${projectId}/playground?localMode=1`;
			await openBrowser(playgroundUrl);

			printDevStatus({
				port,
				localUrl,
				playgroundUrl,
				packageManager: pm,
			});
		} catch (error) {
			handleError(error, json);
			void cleanup(1);
		}
	});
