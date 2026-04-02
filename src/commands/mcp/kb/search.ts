import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../../lib/api.js";
import { handleError } from "../../../lib/errors.js";
import { formatOutput } from "../../../lib/output.js";

interface SearchResult {
	source: string;
	heading: string;
	content: string;
	score: number;
	metadata?: Record<string, string>;
}

export const searchCommand = new Command("search")
	.description("Search the knowledge base")
	.argument("<query>", "Search query")
	.option("-k, --top-k <number>", "Number of results (1-20)", "5")
	.option("-s, --min-score <number>", "Minimum similarity score (0-1)", "0.3")
	.action(async (query, options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Searching...").start();

			const results = await api.post<SearchResult[]>("/api/mcp/kb/search", {
				query,
				topK: Number(options.topK),
				minScore: Number(options.minScore),
			});

			spinner.stop();

			if (json) {
				formatOutput(results, true);
			} else {
				if (results.length === 0) {
					console.log("No results found.");
					return;
				}

				console.log(chalk.bold(`\n  ${results.length} result(s):\n`));

				for (const result of results) {
					const score = (result.score * 100).toFixed(1);
					console.log(
						`  ${chalk.cyan(result.source)} ${chalk.dim(">")} ${chalk.white(result.heading)} ${chalk.dim(`(${score}%)`)}`,
					);

					// Show a preview of the content (first 150 chars)
					const preview = result.content.replace(/\n+/g, " ").slice(0, 150);
					console.log(
						`  ${chalk.dim(preview)}${result.content.length > 150 ? "..." : ""}`,
					);
					console.log();
				}
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
