import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatTable } from "../../lib/output.js";
import type { Mcp, McpListResponse } from "../../types/index.js";

export const listCommand = new Command("list")
	.description("List all MCPs in your organization")
	.option("--all", "Include stopped/expired MCPs")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching MCPs...").start();

			const mcps = await api.get<McpListResponse>(
				`/api/admin/mcps${options.all ? "?all=true" : ""}`,
			);

			spinner.stop();

			const activeMcpId = await config.getActiveMcpId();

			if (json) {
				formatOutput(
					{
						mcps: mcps.map((m: Mcp) => ({
							...m,
							isActive: m.id === activeMcpId,
						})),
						activeMcpId,
					},
					true,
				);
			} else {
				if (mcps.length === 0) {
					console.log("No MCPs found.");
					console.log("\nCreate a new MCP sandbox: waniwani mcp create <name>");
					return;
				}

				console.log(chalk.bold("\nMCPs:\n"));

				const rows = mcps.map((m: Mcp) => {
					const isActive = m.id === activeMcpId;
					const statusColor =
						m.status === "active"
							? chalk.green
							: m.status === "stopped"
								? chalk.red
								: chalk.yellow;

					return [
						isActive
							? chalk.cyan(`* ${m.id.slice(0, 8)}`)
							: `  ${m.id.slice(0, 8)}`,
						m.name,
						statusColor(m.status),
						m.previewUrl,
						m.createdAt ? new Date(m.createdAt).toLocaleString() : "N/A",
					];
				});

				formatTable(
					["ID", "Name", "Status", "Preview URL", "Created"],
					rows,
					false,
				);

				console.log();
				if (activeMcpId) {
					console.log(`Active MCP: ${chalk.cyan(activeMcpId.slice(0, 8))}`);
				}
				console.log("\nSelect an MCP: waniwani mcp use <name>");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
