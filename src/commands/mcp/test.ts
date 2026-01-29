import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { config } from "../../lib/config.js";
import { handleError, McpError, SandboxError } from "../../lib/errors.js";
import { formatOutput, formatTable } from "../../lib/output.js";
import type {
	McpCallResponse,
	McpTestResponse,
	McpToolResult,
} from "../../types/index.js";

export const testCommand = new Command("test")
	.description("Test MCP tools via the sandbox")
	.argument("[tool]", "Tool name to test (lists tools if omitted)")
	.argument("[args...]", "JSON arguments for the tool")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(
		async (tool: string | undefined, args: string[], options, command) => {
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

				if (!tool) {
					// List tools
					const spinner = ora("Fetching available tools...").start();
					const result = await api.post<McpTestResponse>(
						`/api/mcp/sandboxes/${mcpId}/test`,
						{ action: "list" },
					);
					spinner.stop();

					const tools = result.tools;

					if (json) {
						formatOutput({ tools }, true);
					} else {
						if (tools.length === 0) {
							console.log("No tools available.");
						} else {
							console.log(chalk.bold("\nAvailable Tools:\n"));
							formatTable(
								["Name", "Description"],
								tools.map((t) => [t.name, t.description || "No description"]),
								false,
							);
							console.log(
								`\nTest a tool: waniwani mcp test <tool-name> '{"arg": "value"}'`,
							);
						}
					}
				} else {
					// Call tool
					let toolArgs: Record<string, unknown> = {};
					if (args.length > 0) {
						try {
							toolArgs = JSON.parse(args.join(" "));
						} catch {
							throw new SandboxError(
								`Invalid JSON arguments. Expected format: '{"key": "value"}'`,
							);
						}
					}

					const spinner = ora(`Calling tool "${tool}"...`).start();
					const startTime = Date.now();
					const result = await api.post<McpCallResponse>(
						`/api/mcp/sandboxes/${mcpId}/test`,
						{
							action: "call",
							tool,
							args: toolArgs,
						},
					);
					const duration = result.duration || Date.now() - startTime;
					spinner.stop();

					const output: McpToolResult = {
						tool,
						input: toolArgs,
						result: result.result,
						duration,
					};

					if (json) {
						formatOutput(output, true);
					} else {
						console.log(chalk.bold("\nTool Result:\n"));
						console.log(chalk.gray("Tool:"), tool);
						console.log(chalk.gray("Input:"), JSON.stringify(toolArgs));
						console.log(chalk.gray("Duration:"), `${duration}ms`);
						console.log(chalk.gray("Result:"));
						console.log(JSON.stringify(result.result, null, 2));
					}
				}
			} catch (error) {
				handleError(error, json);
				process.exit(1);
			}
		},
	);
