import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../../lib/api.js";
import { handleError } from "../../../lib/errors.js";
import { formatOutput } from "../../../lib/output.js";
import { loadProjectConfig } from "../../../lib/project-config.js";

const DEFAULT_KB_DIR = "knowledge-base";
const BATCH_SIZE = 100;

interface IngestResult {
	chunksIngested: number;
	filesProcessed: number;
}

async function findMdFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await findMdFiles(fullPath)));
		} else if (entry.name.endsWith(".md")) {
			files.push(fullPath);
		}
	}
	return files;
}

export const ingestCommand = new Command("ingest")
	.description("Ingest markdown files into the knowledge base")
	.option(
		"-d, --dir <path>",
		"Path to knowledge base directory (overrides config)",
	)
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			// Resolve KB directory
			const projectConfig = await loadProjectConfig();
			const kbDir = join(
				process.cwd(),
				options.dir ?? projectConfig?.knowledgeBase?.dir ?? DEFAULT_KB_DIR,
			);

			const spinner = ora("Scanning for markdown files...").start();

			let mdFilePaths: string[];
			try {
				mdFilePaths = await findMdFiles(kbDir);
			} catch {
				spinner.fail();
				throw new Error(
					`Knowledge base directory not found: ${kbDir}\nCreate it or set knowledgeBase.dir in waniwani.config.ts`,
				);
			}

			if (mdFilePaths.length === 0) {
				spinner.fail("No markdown files found");
				return;
			}

			spinner.succeed(`Found ${mdFilePaths.length} markdown file(s)`);

			// Build file payloads
			const files: Array<{
				filename: string;
				content: string;
			}> = [];

			for (const fullPath of mdFilePaths) {
				const filename = relative(kbDir, fullPath);
				const content = await readFile(fullPath, "utf-8");
				files.push({ filename, content });
			}

			// Ingest in batches
			const ingestSpinner = ora(`Ingesting ${files.length} file(s)...`).start();

			let totalChunks = 0;
			let totalFiles = 0;

			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				const batch = files.slice(i, i + BATCH_SIZE);
				const result = await api.post<IngestResult>("/api/mcp/kb/ingest", {
					files: batch,
				});
				totalChunks += result.chunksIngested;
				totalFiles += result.filesProcessed;

				if (files.length > BATCH_SIZE) {
					const done = Math.min(i + BATCH_SIZE, files.length);
					ingestSpinner.text = `Ingesting... (${done}/${files.length} files sent)`;
				}
			}

			ingestSpinner.succeed("Ingestion complete");

			if (json) {
				formatOutput(
					{ filesProcessed: totalFiles, chunksIngested: totalChunks },
					true,
				);
			} else {
				console.log();
				console.log(`  ${chalk.bold("Files processed:")} ${totalFiles}`);
				console.log(`  ${chalk.bold("Chunks created:")}  ${totalChunks}`);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
