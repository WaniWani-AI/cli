import { rm } from "node:fs/promises";
import { Command } from "commander";
import ora from "ora";
import { CLIError, handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { findProjectRoot } from "../../lib/sync.js";

export const clearCommand = new Command("clear")
	.description("Delete the local MCP project folder")
	.option("--force", "Skip confirmation")
	.action(async (_options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const cwd = process.cwd();

			// Find project root
			const projectRoot = await findProjectRoot(cwd);
			if (!projectRoot) {
				throw new CLIError(
					"Not in a WaniWani project. No .waniwani directory found.",
					"NOT_IN_PROJECT",
				);
			}

			// Safety check: don't delete if we're at a path that looks like home or root
			if (projectRoot === "/" || projectRoot === process.env.HOME) {
				throw new CLIError(
					"Refusing to delete home or root directory.",
					"UNSAFE_DELETE",
				);
			}

			const spinner = ora(`Deleting ${projectRoot}...`).start();

			// Remove the entire project folder
			await rm(projectRoot, { recursive: true, force: true });

			spinner.succeed("Project folder deleted");

			if (json) {
				formatOutput({ deleted: projectRoot }, true);
			} else {
				formatSuccess(`Deleted: ${projectRoot}`, false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
