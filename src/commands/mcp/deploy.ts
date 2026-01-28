import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type { DeployResponse } from "../../types/index.js";

export const deployCommand = new Command("deploy")
	.description("Deploy MCP server to GitHub + Vercel from sandbox")
	.option("--repo <name>", "GitHub repository name")
	.option("--org <name>", "GitHub organization")
	.option("--private", "Create private repository")
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

			const spinner = ora("Deploying to GitHub...").start();

			const result = await api.post<DeployResponse>(
				`/api/admin/mcps/${mcpId}/deploy`,
				{
					repoName: options.repo,
					org: options.org,
					private: options.private ?? false,
				},
			);

			spinner.succeed("Deployment complete!");

			if (json) {
				formatOutput(result, true);
			} else {
				console.log();
				formatSuccess("MCP server deployed!", false);
				console.log();
				console.log(`  Repository: ${result.repository.url}`);
				if (result.deployment.url) {
					console.log(`  Deployment: ${result.deployment.url}`);
				}
				console.log();
				if (result.deployment.note) {
					console.log(`Note: ${result.deployment.note}`);
				}
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
