import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatList, formatOutput } from "../../lib/output.js";
import type { ServerStartResponse } from "../../types/index.js";

export const startCommand = new Command("start")
	.description("Start the MCP server (npm run dev)")
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
						"No active MCP. Run 'waniwani mcp create <name>' or 'waniwani mcp use <name>'.",
					);
				}
			}

			const spinner = ora("Starting MCP server...").start();

			const result = await api.post<ServerStartResponse>(
				`/api/mcp/sandboxes/${mcpId}/server`,
				{ action: "start" },
			);

			spinner.succeed("MCP server started");

			if (json) {
				formatOutput(result, true);
			} else {
				console.log();
				formatList(
					[
						{ label: "Command ID", value: result.cmdId },
						{ label: "Preview URL", value: chalk.cyan(result.previewUrl) },
					],
					false,
				);
				console.log();
				console.log(chalk.bold("Test with MCP Inspector:"));
				console.log(
					`  npx @modelcontextprotocol/inspector --url ${result.previewUrl}`,
				);
				console.log();
				console.log(
					chalk.gray("Run 'waniwani mcp logs' to stream server output"),
				);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
