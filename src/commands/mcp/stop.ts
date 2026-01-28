import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";

export const stopCommand = new Command("stop")
	.description("Stop and clean up the MCP sandbox")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			let mcpId = options.mcpId;

			if (!mcpId) {
				mcpId = await config.getActiveMcpId();
				if (!mcpId) {
					throw new McpError("No active MCP. Use --mcp-id to specify one.");
				}
			}

			const spinner = ora("Stopping MCP sandbox...").start();
			await api.delete(`/api/admin/mcps/${mcpId}`);
			spinner.succeed("MCP sandbox stopped");

			// Clear active MCP if it was the one we stopped
			if ((await config.getActiveMcpId()) === mcpId) {
				await config.setActiveMcpId(null);
			}

			if (json) {
				formatOutput({ stopped: mcpId }, true);
			} else {
				formatSuccess("MCP sandbox stopped and cleaned up.", false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
