import { input } from "@inquirer/prompts";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { CLIError, handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { collectFiles, findProjectRoot } from "../../lib/sync.js";
import { requireMcpId } from "../../lib/utils.js";
import type { DeployToGithubResponse } from "../../types/index.js";

export const publishCommand = new Command("publish")
	.description("Push local files to GitHub and trigger deployment")
	.option("-m, --message <msg>", "Commit message")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const mcpId = await requireMcpId(options.mcpId);

			// Find project root
			const projectRoot = await findProjectRoot(process.cwd());
			if (!projectRoot) {
				throw new CLIError(
					"Not in a WaniWani project. Run 'waniwani mcp create <name>' first.",
					"NOT_IN_PROJECT",
				);
			}

			// Get commit message
			let message = options.message;
			if (!message) {
				message = await input({
					message: "Commit message:",
					validate: (value) =>
						value.trim() ? true : "Commit message is required",
				});
			}

			const spinner = ora("Collecting files...").start();

			// Collect all files from the project
			const files = await collectFiles(projectRoot);

			if (files.length === 0) {
				spinner.fail("No files to deploy");
				return;
			}

			spinner.text = `Pushing ${files.length} files to GitHub...`;

			const result = await api.post<DeployToGithubResponse>(
				`/api/mcp/repositories/${mcpId}/deploy`,
				{ files, message },
			);

			spinner.succeed(`Pushed to GitHub (${result.commitSha.slice(0, 7)})`);

			if (json) {
				formatOutput(result, true);
			} else {
				console.log();
				formatSuccess("Files pushed to GitHub!", false);
				console.log();
				console.log("Deployment will start automatically via webhook.");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
