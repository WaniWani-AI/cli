import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config, globalConfig } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type { CreateMcpResponse } from "../../types/index.js";

export const createCommand = new Command("create")
	.description("Create a new MCP sandbox from template")
	.argument("<name>", "Name for the MCP project")
	.option("--global", "Save to global config instead of project config")
	.action(async (name: string, options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Creating MCP sandbox...").start();

			const result = await api.post<CreateMcpResponse>("/api/mcp/sandboxes", {
				name,
			});

			spinner.succeed("MCP sandbox created");

			const cfg = options.global ? globalConfig : config;
			await cfg.setMcpId(result.id);

			if (json) {
				formatOutput({ ...result, scope: cfg.scope }, true);
			} else {
				console.log();
				formatSuccess(`MCP sandbox "${name}" created! (${cfg.scope})`, false);
				console.log();
				console.log(`  MCP ID:      ${result.id}`);
				console.log(`  Sandbox ID:  ${result.sandboxId}`);
				console.log(`  Preview URL: ${result.previewUrl}`);
				console.log();
				console.log(`Next steps:`);
				console.log(`  waniwani task "Add a tool that does X"`);
				console.log(`  waniwani mcp test`);
				console.log(`  waniwani mcp deploy`);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
