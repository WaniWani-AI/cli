import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../../lib/api.js";
import { handleError } from "../../../lib/errors.js";
import { formatOutput, formatTable } from "../../../lib/output.js";

interface KbSource {
	source: string;
	chunkCount: number;
	createdAt: string;
}

export const sourcesCommand = new Command("sources")
	.description("List ingested knowledge base sources")
	.action(async (_options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching sources...").start();

			const sources = await api.get<KbSource[]>("/api/mcp/kb/sources");

			spinner.stop();

			if (json) {
				formatOutput(sources, true);
			} else {
				if (sources.length === 0) {
					console.log("No sources found.");
					console.log("\nIngest files: waniwani mcp kb ingest");
					return;
				}

				const totalChunks = sources.reduce((sum, s) => sum + s.chunkCount, 0);

				const rows = sources.map((s) => [
					s.source,
					String(s.chunkCount),
					new Date(s.createdAt).toLocaleDateString(),
				]);

				formatTable(["Source", "Chunks", "Ingested"], rows, false);

				console.log();
				console.log(
					chalk.dim(
						`  ${sources.length} source(s), ${totalChunks} chunk(s) total`,
					),
				);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
