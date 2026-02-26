import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import ignore from "ignore";
import type { PullFilesResponse } from "../types/index.js";
import { api } from "./api.js";
import { detectBinary, isBinaryPath } from "./utils.js";

const PROJECT_DIR = ".waniwani";

/**
 * Find the project root by walking up from the given directory
 * looking for a .waniwani directory
 */
export async function findProjectRoot(
	startDir: string,
): Promise<string | null> {
	let current = startDir;
	const root = dirname(current);

	while (current !== root) {
		if (existsSync(join(current, PROJECT_DIR))) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}

	// Check root as well
	if (existsSync(join(current, PROJECT_DIR))) {
		return current;
	}

	return null;
}

/**
 * Default patterns to always ignore
 */
const DEFAULT_IGNORE_PATTERNS = [
	".waniwani",
	".git",
	"node_modules",
	".DS_Store",
	"*.log",
	".cache",
	"dist",
	"coverage",
	".turbo",
	".next",
	".nuxt",
	".vercel",
];

const DEFAULT_ENV_IGNORE_PATTERNS = [".env", ".env.*"];

export interface SyncIgnoreOptions {
	includeEnvFiles?: boolean;
}

/**
 * Load ignore patterns from .gitignore and add defaults
 */
export async function loadIgnorePatterns(
	projectRoot: string,
	options: SyncIgnoreOptions = {},
): Promise<ReturnType<typeof ignore>> {
	const { includeEnvFiles = false } = options;
	const ig = ignore();

	// Add default patterns
	ig.add(DEFAULT_IGNORE_PATTERNS);
	if (!includeEnvFiles) {
		ig.add(DEFAULT_ENV_IGNORE_PATTERNS);
	}

	// Load .gitignore if it exists
	const gitignorePath = join(projectRoot, ".gitignore");
	if (existsSync(gitignorePath)) {
		try {
			const content = await readFile(gitignorePath, "utf-8");
			ig.add(content);
		} catch {
			// Ignore read errors
		}
	}

	// For local preview hydration, include env files even if they're gitignored.
	if (includeEnvFiles) {
		ig.add(["!.env", "!.env.*"]);
	}

	return ig;
}

export interface FileToSync {
	path: string;
	content: string;
	encoding: "utf8" | "base64";
}

/**
 * Collect all files in a directory that should be synced
 * Respects .gitignore and default ignore patterns
 */
export async function collectFiles(
	projectRoot: string,
	options: SyncIgnoreOptions = {},
): Promise<FileToSync[]> {
	const ig = await loadIgnorePatterns(projectRoot, options);
	const files: FileToSync[] = [];

	async function walk(dir: string) {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			const relativePath = relative(projectRoot, fullPath);

			// Check if path is ignored
			if (ig.ignores(relativePath)) {
				continue;
			}

			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile()) {
				try {
					const content = await readFile(fullPath);
					const isBinary = isBinaryPath(fullPath) || detectBinary(content);

					files.push({
						path: relativePath,
						content: isBinary
							? content.toString("base64")
							: content.toString("utf8"),
						encoding: isBinary ? "base64" : "utf8",
					});
				} catch {
					// Skip files that can't be read
				}
			}
		}
	}

	await walk(projectRoot);
	return files;
}

/**
 * Pull all files from GitHub to a local directory.
 * Uses a single API call to fetch all files from the repository.
 */
export async function pullFilesFromGithub(
	mcpId: string,
	targetDir: string,
): Promise<{ count: number; files: string[] }> {
	// Fetch all files from GitHub in one request
	const result = await api.get<PullFilesResponse>(
		`/api/mcp/repositories/${mcpId}/files`,
	);

	const writtenFiles: string[] = [];

	for (const file of result.files) {
		const localPath = join(targetDir, file.path);
		const dir = dirname(localPath);

		// Ensure directory exists
		await mkdir(dir, { recursive: true });

		// Write file content
		if (file.encoding === "base64") {
			await writeFile(localPath, Buffer.from(file.content, "base64"));
		} else {
			await writeFile(localPath, file.content, "utf8");
		}

		writtenFiles.push(file.path);
	}

	return { count: writtenFiles.length, files: writtenFiles };
}

/**
 * Collect a single file for syncing
 */
export async function collectSingleFile(
	projectRoot: string,
	filePath: string,
): Promise<FileToSync | null> {
	const fullPath = join(projectRoot, filePath);
	const relativePath = relative(projectRoot, fullPath);

	// Check if file exists
	if (!existsSync(fullPath)) {
		return null;
	}

	try {
		const fileStat = await stat(fullPath);
		if (!fileStat.isFile()) {
			return null;
		}

		const content = await readFile(fullPath);
		const isBinary = isBinaryPath(fullPath) || detectBinary(content);

		return {
			path: relativePath,
			content: isBinary ? content.toString("base64") : content.toString("utf8"),
			encoding: isBinary ? "base64" : "utf8",
		};
	} catch {
		return null;
	}
}
