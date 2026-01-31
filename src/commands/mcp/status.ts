import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { handleError } from "../../lib/errors.js";
import { formatList, formatOutput } from "../../lib/output.js";
import { requireMcpId } from "../../lib/utils.js";
import type { McpRepository, ServerStatusResponse } from "../../types/index.js";

export const statusCommand = new Command("status")
	.description("Show current MCP status")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const mcpId = await requireMcpId(options.mcpId);

			const spinner = ora("Fetching MCP status...").start();

			const result = await api.get<McpRepository>(
				`/api/mcp/repositories/${mcpId}`,
			);

			// Fetch server status if sandbox is active
			let serverStatus: ServerStatusResponse | null = null;
			if (result.activeSandbox) {
				serverStatus = await api
					.post<ServerStatusResponse>(
						`/api/mcp/repositories/${mcpId}/sandbox/server`,
						{ action: "status" },
					)
					.catch(() => null);
			}

			spinner.stop();

			if (json) {
				formatOutput({ ...result, server: serverStatus }, true);
			} else {
				const deployStatus = result.deployedAt
					? chalk.green("Deployed")
					: chalk.yellow("Pending");

				const items = [
					{ label: "Name", value: result.name },
					{ label: "MCP ID", value: result.id },
					{ label: "Status", value: deployStatus },
					{
						label: "Last Deploy",
						value: result.deployedAt
							? new Date(result.deployedAt).toLocaleString()
							: chalk.gray("Never"),
					},
					{
						label: "Created",
						value: new Date(result.createdAt).toLocaleString(),
					},
				];

				// Add sandbox info if active
				if (result.activeSandbox) {
					const sandbox = result.activeSandbox;
					const serverRunning = serverStatus?.running ?? sandbox.serverRunning;
					const serverStatusColor = serverRunning ? chalk.green : chalk.yellow;

					items.push(
						{ label: "", value: "" }, // Separator
						{ label: "Sandbox", value: chalk.green("Active") },
						{ label: "Preview URL", value: sandbox.previewUrl },
						{
							label: "Server",
							value: serverStatusColor(serverRunning ? "Running" : "Stopped"),
						},
						{
							label: "Expires",
							value: sandbox.expiresAt
								? new Date(sandbox.expiresAt).toLocaleString()
								: chalk.gray("N/A"),
						},
					);
				} else {
					items.push(
						{ label: "", value: "" }, // Separator
						{ label: "Sandbox", value: chalk.gray("None") },
					);
				}

				formatList(items, false);

				console.log();
				if (!result.activeSandbox) {
					console.log("Start development: waniwani mcp dev");
				} else if (!serverStatus?.running) {
					console.log("View logs: waniwani mcp logs");
				}
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
