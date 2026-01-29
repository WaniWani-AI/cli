import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatList, formatOutput } from "../../lib/output.js";
import type { Mcp, ServerStatusResponse } from "../../types/index.js";

export const statusCommand = new Command("status")
	.description("Show current MCP sandbox status")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			let mcpId = options.mcpId;

			if (!mcpId) {
				mcpId = await config.getMcpId();
				if (!mcpId) {
					throw new McpError(
						"No active MCP. Run 'waniwani mcp create <name>' to create one or 'waniwani mcp use <name>' to select one.",
					);
				}
			}

			const spinner = ora("Fetching MCP status...").start();

			// Fetch sandbox status and server status in parallel
			const [result, serverStatus] = await Promise.all([
				api.get<Mcp>(`/api/mcp/sandboxes/${mcpId}`),
				api
					.post<ServerStatusResponse>(`/api/mcp/sandboxes/${mcpId}/server`, {
						action: "status",
					})
					.catch(() => ({
						running: false,
						cmdId: undefined,
						previewUrl: undefined,
					})),
			]);

			spinner.stop();

			if (json) {
				formatOutput({ ...result, server: serverStatus }, true);
			} else {
				const statusColor =
					result.status === "active" ? chalk.green : chalk.red;
				const serverRunning = serverStatus.running;
				const serverStatusColor = serverRunning ? chalk.green : chalk.yellow;

				formatList(
					[
						{ label: "MCP ID", value: result.id },
						{ label: "Name", value: result.name },
						{ label: "Status", value: statusColor(result.status) },
						{ label: "Sandbox ID", value: result.sandboxId },
						{ label: "Preview URL", value: result.previewUrl },
						{
							label: "Server",
							value: serverStatusColor(serverRunning ? "Running" : "Stopped"),
						},
						...(serverStatus.cmdId
							? [{ label: "Server Cmd ID", value: serverStatus.cmdId }]
							: []),
						{ label: "Created", value: result.createdAt },
						{ label: "Expires", value: result.expiresAt ?? "N/A" },
					],
					false,
				);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
