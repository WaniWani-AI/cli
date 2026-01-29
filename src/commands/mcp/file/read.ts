import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../../lib/api.js";
import { config } from "../../../lib/config.js";
import { handleError, McpError } from "../../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../../lib/output.js";
import type { ReadFileResponse } from "../../../types/index.js";

export const readCommand = new Command("read")
	.description("Read a file from the MCP sandbox")
	.argument("<path>", "Path in sandbox (e.g., /app/src/index.ts)")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("--output <file>", "Write to local file instead of stdout")
	.option("--base64", "Output as base64 (for binary files)")
	.action(async (path: string, options, command) => {
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

			const encoding = options.base64 ? "base64" : "utf8";
			const spinner = ora(`Reading ${path}...`).start();

			const result = await api.get<ReadFileResponse>(
				`/api/mcp/sandboxes/${mcpId}/files?path=${encodeURIComponent(path)}&encoding=${encoding}`,
			);

			spinner.stop();

			if (!result.exists) {
				throw new McpError(`File not found: ${path}`);
			}

			if (options.output) {
				// Write to local file
				const buffer =
					result.encoding === "base64"
						? Buffer.from(result.content, "base64")
						: Buffer.from(result.content, "utf8");
				await writeFile(options.output, buffer);
				if (json) {
					formatOutput({ path, savedTo: options.output }, true);
				} else {
					formatSuccess(`Saved to ${options.output}`, false);
				}
			} else if (json) {
				formatOutput(result, true);
			} else {
				// Print to stdout
				process.stdout.write(result.content);
				// Add newline if content doesn't end with one
				if (!result.content.endsWith("\n")) {
					process.stdout.write("\n");
				}
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
