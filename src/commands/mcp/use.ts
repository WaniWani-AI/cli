import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type {
	McpRepository,
	McpRepositoryListResponse,
} from "../../types/index.js";

export const useCommand = new Command("use")
	.description("Select an MCP to use for subsequent commands")
	.argument("<name>", "Name of the MCP to use")
	.action(async (name: string, _options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching MCPs...").start();

			// Fetch all MCPs
			const mcps = await api.get<McpRepositoryListResponse>(
				"/api/mcp/repositories",
			);

			spinner.stop();

			// Find MCP by name
			const mcp = mcps.find((m: McpRepository) => m.name === name);

			if (!mcp) {
				throw new McpError(
					`MCP "${name}" not found. Run 'waniwani mcp list' to see available MCPs.`,
				);
			}

			await config.setMcpId(mcp.id);
			// Clear session since we're switching MCPs
			await config.setSessionId(null);

			if (json) {
				formatOutput({ selected: mcp }, true);
			} else {
				formatSuccess(`Now using MCP "${name}"`, false);
				console.log();
				console.log(`  MCP ID: ${mcp.id}`);
				console.log();
				console.log("Next steps:");
				console.log("  waniwani mcp dev      # Start live preview");
				console.log("  waniwani mcp status   # Check status");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
