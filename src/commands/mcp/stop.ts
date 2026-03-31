import { Command } from "commander";
import ora from "ora";
import { getClient } from "../../lib/client.js";
import { config } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { requireMcpId, requireSessionId } from "../../lib/utils.js";

export const stopCommand = new Command("stop")
	.description("Stop the development environment (sandbox + server)")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			await requireMcpId(options.mcpId);
			const sessionId = await requireSessionId();

			const spinner = ora("Stopping development environment...").start();

			const client = await getClient();

			// Stop server first
			try {
				await client.stopServer(sessionId);
			} catch {
				// Server might not be running, continue
			}

			// Delete session
			await client.deleteSession(sessionId);

			// Clear session from config
			await config.setSessionId(null);

			spinner.succeed("Development environment stopped");

			if (json) {
				formatOutput({ stopped: true }, true);
			} else {
				formatSuccess("Sandbox stopped.", false);
				console.log();
				console.log("Start again: waniwani mcp preview");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
