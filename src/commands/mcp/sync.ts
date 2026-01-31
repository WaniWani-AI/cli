import { Command } from "commander";
import ora from "ora";
import { CLIError, handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { findProjectRoot, pullFilesFromGithub } from "../../lib/sync.js";
import { requireMcpId } from "../../lib/utils.js";

export const syncCommand = new Command("sync")
	.description("Pull files from GitHub to local project")
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
					"Not in a WaniWani project. Run 'waniwani mcp init <name>' first.",
					"NOT_IN_PROJECT",
				);
			}

			const spinner = ora("Pulling files from GitHub...").start();

			const result = await pullFilesFromGithub(mcpId, projectRoot);

			spinner.succeed(`Pulled ${result.count} files from GitHub`);

			if (json) {
				formatOutput({ files: result.files }, true);
			} else {
				console.log();
				formatSuccess("Files synced from GitHub!", false);
				if (result.files.length > 0 && result.files.length <= 10) {
					console.log();
					for (const file of result.files) {
						console.log(`  ${file}`);
					}
				}
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
