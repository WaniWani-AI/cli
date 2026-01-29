import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";

export const deleteCommand = new Command("delete")
	.description("Delete the MCP sandbox")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			let mcpId = options.mcpId;

			if (!mcpId) {
				mcpId = await config.getMcpId();
				if (!mcpId) {
					throw new McpError("No active MCP. Use --mcp-id to specify one.");
				}
			}

			const spinner = ora("Deleting MCP sandbox...").start();
			await api.delete(`/api/mcp/sandboxes/${mcpId}`);
			spinner.succeed("MCP sandbox deleted");

			// Clear active MCP if it was the one we deleted
			if ((await config.getMcpId()) === mcpId) {
				await config.setMcpId(null);
			}

			if (json) {
				formatOutput({ deleted: mcpId }, true);
			} else {
				formatSuccess("MCP sandbox deleted and cleaned up.", false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
