import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import {
	hasProjectConfig,
	saveProjectConfig,
} from "../../lib/project-config.js";
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

			const result = await api.post<CreateMcpResponse>("/api/admin/mcps", {
				name,
			});

			spinner.succeed("MCP sandbox created");

			// Save to project config if in a project, otherwise global
			const useProjectConfig = !options.global && hasProjectConfig();

			if (useProjectConfig) {
				await saveProjectConfig({ mcpId: result.id });
			} else {
				await config.setActiveMcpId(result.id);
			}

			if (json) {
				formatOutput(
					{ ...result, scope: useProjectConfig ? "project" : "global" },
					true,
				);
			} else {
				const scope = useProjectConfig
					? "(saved to project)"
					: "(saved globally)";
				console.log();
				formatSuccess(
					`MCP sandbox "${name}" created successfully! ${scope}`,
					false,
				);
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
