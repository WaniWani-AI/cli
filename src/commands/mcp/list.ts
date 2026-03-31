import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { getClient } from "../../lib/client.js";
import { config } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatTable } from "../../lib/output.js";

export const listCommand = new Command("list")
	.description("List all MCPs in your organization")
	.action(async (_options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching MCPs...").start();

			const client = await getClient();
			const mcps = await client.listRepositories();

			spinner.stop();

			const activeMcpId = await config.getMcpId();

			if (json) {
				formatOutput(
					{
						mcps: mcps.map((m) => ({
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
					console.log("\nCreate a new MCP: waniwani mcp create <name>");
					return;
				}

				console.log(chalk.bold("\nMCPs:\n"));

				const rows = mcps.map((m) => {
					const isActive = m.id === activeMcpId;
					const deployStatus = m.deployedAt
						? chalk.green("Deployed")
						: chalk.yellow("Pending");
					const sandboxStatus = m.activeSandbox
						? chalk.green("Active")
						: chalk.gray("None");
					const lastDeploy = m.deployedAt
						? new Date(m.deployedAt).toLocaleDateString()
						: chalk.gray("Never");

					return [
						isActive ? chalk.cyan(`* ${m.name}`) : `  ${m.name}`,
						deployStatus,
						sandboxStatus,
						lastDeploy,
					];
				});

				formatTable(["Name", "Status", "Sandbox", "Last Deploy"], rows, false);

				console.log();
				if (activeMcpId) {
					const activeMcp = mcps.find((m) => m.id === activeMcpId);
					if (activeMcp) {
						console.log(`Active MCP: ${chalk.cyan(activeMcp.name)}`);
					}
				}
				console.log("\nSelect an MCP: waniwani mcp use <name>");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
