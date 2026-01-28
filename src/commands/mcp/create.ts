import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import type { CreateMcpResponse } from "../../types/index.js";

export const createCommand = new Command("create")
	.description("Create a new MCP sandbox from template")
	.argument("<name>", "Name for the MCP project")
	.action(async (name: string, _, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Creating MCP sandbox...").start();

			const result = await api.post<CreateMcpResponse>("/api/admin/mcps", {
				name,
			});

			spinner.succeed("MCP sandbox created");

			// Set active MCP ID locally
			config.setActiveMcpId(result.id);

			if (json) {
				formatOutput(result, true);
			} else {
				console.log();
				formatSuccess(`MCP sandbox "${name}" created successfully!`, false);
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
