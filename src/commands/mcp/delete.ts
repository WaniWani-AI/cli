import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { getClient } from "../../lib/client.js";
import { config } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { requireMcpId } from "../../lib/utils.js";

export const deleteCommand = new Command("delete")
	.description("Delete the MCP (includes all associated resources)")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("--force", "Skip confirmation prompt")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const mcpId = await requireMcpId(options.mcpId);
			const client = await getClient();

			// Get MCP details for confirmation
			const mcp = await client.getRepository(mcpId);

			// Require confirmation unless --force
			if (!options.force && !json) {
				console.log();
				console.log(chalk.yellow("This will permanently delete:"));
				console.log(`  - MCP: ${mcp.name}`);
				if (mcp.activeSandbox) {
					console.log("  - Active sandbox");
				}
				console.log();

				const confirmed = await confirm({
					message: `Delete "${mcp.name}"?`,
					default: false,
				});

				if (!confirmed) {
					console.log("Cancelled.");
					return;
				}
			}

			const spinner = ora("Deleting MCP...").start();
			await client.deleteRepository(mcpId);
			spinner.succeed("MCP deleted");

			// Clear active MCP and session if it was the one we deleted
			if ((await config.getMcpId()) === mcpId) {
				await config.setMcpId(null);
				await config.setSessionId(null);
			}

			if (json) {
				formatOutput({ deleted: mcpId }, true);
			} else {
				formatSuccess("MCP deleted.", false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
