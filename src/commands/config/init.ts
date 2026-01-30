import { existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
	CONFIG_FILE_NAME,
	initConfigAt,
	LOCAL_CONFIG_DIR,
} from "../../lib/config.js";
import { CLIError, handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";

export const configInitCommand = new Command("init")
	.description("Initialize .waniwani config in the current directory")
	.option("--force", "Overwrite existing config")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const cwd = process.cwd();
			const configPath = join(cwd, LOCAL_CONFIG_DIR, CONFIG_FILE_NAME);

			// Check if config already exists
			if (existsSync(configPath) && !options.force) {
				throw new CLIError(
					`Config already exists at ${configPath}. Use --force to overwrite.`,
					"CONFIG_EXISTS",
				);
			}

			// Create .waniwani/settings.json with defaults
			const result = await initConfigAt(cwd);

			if (json) {
				formatOutput({ created: result.path, config: result.config }, true);
			} else {
				formatSuccess(`Created ${result.path}`, false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
