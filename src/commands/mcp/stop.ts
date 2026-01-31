import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { requireMcpId } from "../../lib/utils.js";

export const stopCommand = new Command("stop")
	.description("Stop the development environment (sandbox + server)")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const mcpId = await requireMcpId(options.mcpId);

			const spinner = ora("Stopping development environment...").start();

			// Stop server first
			try {
				await api.post(`/api/mcp/repositories/${mcpId}/sandbox/server`, {
					action: "stop",
				});
			} catch {
				// Server might not be running, continue
			}

			// Delete sandbox
			await api.delete(`/api/mcp/repositories/${mcpId}/sandbox`);

			spinner.succeed("Development environment stopped");

			if (json) {
				formatOutput({ stopped: true }, true);
			} else {
				formatSuccess("Sandbox stopped.", false);
				console.log();
				console.log("Start again: waniwani mcp dev");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
