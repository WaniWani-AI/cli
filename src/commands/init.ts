import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { handleError } from "../lib/errors.js";
import { formatOutput, formatSuccess } from "../lib/output.js";

const PROJECT_CONFIG_DIR = ".waniwani";
const PROJECT_CONFIG_FILE = "settings.local.json";

export const initCommand = new Command("init")
	.description("Initialize WaniWani project config in current directory")
	.action(async (_, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const cwd = process.cwd();
			const configDir = join(cwd, PROJECT_CONFIG_DIR);
			const configPath = join(configDir, PROJECT_CONFIG_FILE);

			if (existsSync(configDir)) {
				if (json) {
					formatOutput(
						{ initialized: false, message: "Already initialized" },
						true,
					);
				} else {
					console.log("Project already initialized (.waniwani/ exists)");
				}
				return;
			}

			await mkdir(configDir, { recursive: true });

			const defaultConfig = {
				mcpId: null,
				defaults: {},
			};

			await writeFile(
				configPath,
				JSON.stringify(defaultConfig, null, "\t"),
				"utf-8",
			);

			if (json) {
				formatOutput({ initialized: true, path: configDir }, true);
			} else {
				formatSuccess("Initialized WaniWani project config", false);
				console.log();
				console.log(`  Created: ${PROJECT_CONFIG_DIR}/${PROJECT_CONFIG_FILE}`);
				console.log();
				console.log("Now run:");
				console.log('  waniwani mcp create "my-mcp"');
				console.log("  waniwani mcp use <name>");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
