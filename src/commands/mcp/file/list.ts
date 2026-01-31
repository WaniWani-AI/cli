import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../../lib/api.js";
import { handleError } from "../../../lib/errors.js";
import { formatOutput, formatTable } from "../../../lib/output.js";
import { requireMcpId, requireSessionId } from "../../../lib/utils.js";
import type { ListFilesResponse } from "../../../types/index.js";

export const listCommand = new Command("list")
	.description("List files in the MCP sandbox")
	.argument("[path]", "Directory path (defaults to /app)", "/app")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (path: string, options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const mcpId = await requireMcpId(options.mcpId);
			const sessionId = await requireSessionId(mcpId);

			const spinner = ora(`Listing ${path}...`).start();

			const result = await api.get<ListFilesResponse>(
				`/api/mcp/sessions/${sessionId}/files/list?path=${encodeURIComponent(path)}`,
			);

			spinner.stop();

			if (json) {
				formatOutput(result, true);
			} else {
				console.log(chalk.bold(`\nDirectory: ${result.path}\n`));

				if (result.entries.length === 0) {
					console.log("  (empty)");
				} else {
					const rows = result.entries.map((entry) => {
						const name =
							entry.type === "directory"
								? chalk.blue(`${entry.name}/`)
								: entry.name;
						const size =
							entry.type === "directory"
								? chalk.gray("<dir>")
								: formatSize(entry.size);
						return [name, size];
					});

					formatTable(["Name", "Size"], rows, false);
				}
				console.log();
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});

function formatSize(bytes?: number): string {
	if (bytes === undefined) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
