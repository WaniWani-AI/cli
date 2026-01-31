import { readFile } from "node:fs/promises";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../../lib/api.js";
import { CLIError, handleError } from "../../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../../lib/output.js";
import { requireMcpId } from "../../../lib/utils.js";
import type { WriteFilesResponse } from "../../../types/index.js";

export const writeCommand = new Command("write")
	.description("Write a file to the MCP sandbox")
	.argument("<path>", "Path in sandbox (e.g., /app/src/index.ts)")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("--content <content>", "Content to write")
	.option("--file <localFile>", "Local file to upload")
	.option("--base64", "Treat content as base64 encoded")
	.action(async (path: string, options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const mcpId = await requireMcpId(options.mcpId);

			// Get content from --content or --file
			let content: string;
			let encoding: "utf8" | "base64" = "utf8";

			if (options.content) {
				content = options.content;
				if (options.base64) {
					encoding = "base64";
				}
			} else if (options.file) {
				const fileBuffer = await readFile(options.file);
				if (options.base64) {
					content = fileBuffer.toString("base64");
					encoding = "base64";
				} else {
					content = fileBuffer.toString("utf8");
				}
			} else {
				throw new CLIError(
					"Either --content or --file is required",
					"MISSING_CONTENT",
				);
			}

			const spinner = ora(`Writing ${path}...`).start();

			const result = await api.post<WriteFilesResponse>(
				`/api/mcp/repositories/${mcpId}/sandbox/files`,
				{
					files: [{ path, content, encoding }],
				},
			);

			spinner.succeed(`Wrote ${path}`);

			if (json) {
				formatOutput(result, true);
			} else {
				formatSuccess(`File written: ${path}`, false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
