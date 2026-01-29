import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError } from "../../lib/errors.js";
import { formatOutput } from "../../lib/output.js";
import type { RunCommandResponse } from "../../types/index.js";

export const runCommandCommand = new Command("run-command")
	.description("Run a command in the MCP sandbox")
	.argument("<command>", "Command to run")
	.argument("[args...]", "Command arguments")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("--cwd <path>", "Working directory")
	.option(
		"--timeout <ms>",
		"Command timeout in milliseconds (default: 30000, max: 300000)",
	)
	.action(async (cmd: string, args: string[], options, command) => {
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

			const timeout = options.timeout
				? Number.parseInt(options.timeout, 10)
				: undefined;

			const spinner = ora(`Running: ${cmd} ${args.join(" ")}`.trim()).start();

			const result = await api.post<RunCommandResponse>(
				`/api/mcp/sandboxes/${mcpId}/commands`,
				{
					command: cmd,
					args: args.length > 0 ? args : undefined,
					cwd: options.cwd,
					timeout,
				},
			);

			spinner.stop();

			if (json) {
				formatOutput(result, true);
			} else {
				// Show command
				const cmdLine = [cmd, ...args].join(" ");
				console.log(chalk.gray(`$ ${cmdLine}`));
				console.log();

				// Show stdout
				if (result.stdout) {
					process.stdout.write(result.stdout);
					if (!result.stdout.endsWith("\n")) {
						process.stdout.write("\n");
					}
				}

				// Show stderr
				if (result.stderr) {
					process.stderr.write(chalk.red(result.stderr));
					if (!result.stderr.endsWith("\n")) {
						process.stderr.write("\n");
					}
				}

				// Show exit code and duration
				console.log();
				const exitColor = result.exitCode === 0 ? chalk.green : chalk.red;
				console.log(
					exitColor(`Exit code: ${result.exitCode}`),
					chalk.gray(`(${(result.duration / 1000).toFixed(2)}s)`),
				);
			}

			// Exit with the command's exit code
			if (result.exitCode !== 0) {
				process.exit(result.exitCode);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
