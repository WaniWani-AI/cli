import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { handleError } from "../lib/errors.js";
import { formatOutput, formatTable } from "../lib/output.js";
import { loadModule, loadProjectConfig } from "../lib/project-config.js";

interface Scenario {
	name: string;
	persona: string;
	openingMessage: string;
	language: string;
	expectedState?: Record<string, unknown>;
	expectedToolsCalled?: string[];
	maxTurns?: number;
}

interface SimulateResponse {
	runId: string;
}

interface SimulateRunStatus {
	id: string;
	scenarioName: string;
	status: "pending" | "running" | "completed" | "failed";
	result: {
		turns: unknown[];
		accumulatedState: Record<string, unknown>;
		completed: boolean;
		totalTurns: number;
	} | null;
	error: string | null;
	createdAt: string;
	completedAt: string | null;
}

const DEFAULT_MCP_URL = "http://localhost:3001";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 200; // ~10 minutes

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const evalCommand = new Command("eval")
	.description("Run dynamic scenario simulations against your MCP server")
	.option(
		"-c, --config <path>",
		"Path to waniwani.config.ts",
		"waniwani.config.ts",
	)
	.option("-u, --url <url>", "MCP server URL (overrides config)")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			// 1. Load project config
			const spinner = ora("Loading configuration...").start();

			const projectConfig = await loadProjectConfig(options.config);
			if (!projectConfig?.evals?.scenarios) {
				spinner.fail();
				throw new Error(
					"No evals.scenarios path defined in waniwani.config.ts",
				);
			}

			// 2. Load scenarios
			const scenarioModule = await loadModule<{
				scenarios: Scenario[];
			}>(projectConfig.evals.scenarios);
			const scenarios = scenarioModule.scenarios;

			if (!scenarios || scenarios.length === 0) {
				spinner.fail();
				throw new Error(
					`No scenarios found in ${projectConfig.evals.scenarios}`,
				);
			}

			spinner.succeed(
				`Loaded ${scenarios.length} scenario${scenarios.length > 1 ? "s" : ""}`,
			);

			// 3. Resolve MCP server URL and environment ID
			const mcpServerUrl =
				options.url ?? projectConfig.evals.mcpServerUrl ?? DEFAULT_MCP_URL;
			const environmentId = await config.getMcpId();

			if (!environmentId) {
				throw new Error(
					'No MCP environment selected. Run "waniwani mcp use <name>" first.',
				);
			}

			console.log(chalk.dim(`  MCP server: ${mcpServerUrl}`));
			console.log(chalk.dim(`  Environment: ${environmentId}`));
			console.log();

			// 4. Trigger all simulations
			const triggerSpinner = ora(
				`Starting ${scenarios.length} simulation${scenarios.length > 1 ? "s" : ""}...`,
			).start();

			const runs: Array<{
				runId: string;
				scenario: Scenario;
			}> = [];

			for (const scenario of scenarios) {
				const result = await api.post<SimulateResponse>("/api/mcp/simulate", {
					mcpServerUrl,
					environmentId,
					scenario,
					source: "cli",
				});
				runs.push({ runId: result.runId, scenario });
			}

			triggerSpinner.succeed(
				`Started ${runs.length} simulation${runs.length > 1 ? "s" : ""}`,
			);

			// 5. Poll for results
			const pollSpinner = ora("Waiting for results...").start();
			const results: SimulateRunStatus[] = [];
			const pending = new Set(runs.map((r) => r.runId));

			for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
				for (const runId of [...pending]) {
					const status = await api.get<SimulateRunStatus>(
						`/api/mcp/simulate/${runId}`,
					);

					if (status.status === "completed" || status.status === "failed") {
						results.push(status);
						pending.delete(runId);
					}
				}

				if (pending.size === 0) break;

				const completedCount = results.length;
				const totalCount = runs.length;
				pollSpinner.text = `Waiting for results... (${completedCount}/${totalCount} done)`;

				await sleep(POLL_INTERVAL_MS);
			}

			pollSpinner.stop();

			if (pending.size > 0) {
				console.log(
					chalk.yellow(`\n  ${pending.size} simulation(s) timed out`),
				);
			}

			// 6. Display results
			console.log();

			if (json) {
				formatOutput(results, true);
			} else {
				const headers = ["Scenario", "Status", "Turns", "Completed"];
				const rows = results.map((r) => [
					r.scenarioName,
					r.status === "completed"
						? chalk.green(r.status)
						: chalk.red(r.status),
					r.result ? String(r.result.totalTurns) : "-",
					r.result?.completed
						? chalk.green("yes")
						: r.status === "failed"
							? chalk.red(r.error ?? "error")
							: chalk.yellow("no"),
				]);

				formatTable(headers, rows, false);

				// Summary
				const passed = results.filter(
					(r) => r.status === "completed" && r.result?.completed,
				).length;
				const failed = results.length - passed;

				console.log();
				if (failed === 0) {
					console.log(
						chalk.green(
							`  All ${passed} scenario${passed > 1 ? "s" : ""} passed`,
						),
					);
				} else {
					console.log(
						chalk.red(
							`  ${failed} of ${results.length} scenario${results.length > 1 ? "s" : ""} failed`,
						),
					);
				}
			}

			// Exit with error code if any failed
			const allPassed = results.every(
				(r) => r.status === "completed" && r.result?.completed,
			);
			if (!allPassed) {
				process.exit(1);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
