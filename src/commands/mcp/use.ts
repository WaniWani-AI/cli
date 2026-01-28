import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type { Mcp, McpListResponse } from "../../types/index.js";

export const useCommand = new Command("use")
	.description("Select an MCP to use for subsequent commands")
	.argument("<name>", "Name of the MCP to use")
	.action(async (name: string, _, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching MCPs...").start();

			// Fetch all MCPs
			const mcps = await api.get<McpListResponse>("/api/admin/mcps");

			spinner.stop();

			// Find MCP by name
			const mcp = mcps.find((m: Mcp) => m.name === name);

			if (!mcp) {
				throw new McpError(
					`MCP "${name}" not found. Run 'waniwani mcp list' to see available MCPs.`,
				);
			}

			if (mcp.status !== "active") {
				throw new McpError(
					`MCP "${name}" is ${mcp.status}. Only active MCPs can be used.`,
				);
			}

			// Store MCP ID locally
			await config.setActiveMcpId(mcp.id);

			if (json) {
				formatOutput({ selected: mcp }, true);
			} else {
				formatSuccess(`Now using MCP "${name}"`, false);
				console.log();
				console.log(`  MCP ID:      ${mcp.id}`);
				console.log(`  Preview URL: ${mcp.previewUrl}`);
				console.log();
				console.log("Next steps:");
				console.log('  waniwani task "Add a tool"');
				console.log("  waniwani mcp test");
				console.log("  waniwani mcp status");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
