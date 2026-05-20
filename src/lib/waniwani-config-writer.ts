import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_FILENAME = "waniwani.config.ts";

export interface WriteBindingResult {
	path: string;
	created: boolean;
	updated: boolean;
	manualSnippet?: string;
}

interface Binding {
	orgId: string;
	projectId: string;
}

export async function writeBinding(
	cwd: string,
	binding: Binding,
): Promise<WriteBindingResult> {
	const path = join(cwd, CONFIG_FILENAME);

	if (!existsSync(path)) {
		await writeFile(path, renderNewConfig(binding), "utf-8");
		return { path, created: true, updated: false };
	}

	const original = await readFile(path, "utf-8");
	const merged = mergeBinding(original, binding);

	if (!merged) {
		return {
			path,
			created: false,
			updated: false,
			manualSnippet: renderSnippet(binding),
		};
	}

	if (merged !== original) {
		await writeFile(path, merged, "utf-8");
	}

	return { path, created: false, updated: merged !== original };
}

function renderNewConfig(binding: Binding): string {
	return `import type { WaniWaniProjectConfig } from "@waniwani/sdk";

export default {
	orgId: "${binding.orgId}",
	projectId: "${binding.projectId}",
} satisfies WaniWaniProjectConfig;
`;
}

function renderSnippet(binding: Binding): string {
	return `\torgId: "${binding.orgId}",\n\tprojectId: "${binding.projectId}",`;
}

/**
 * Merge orgId/projectId into an existing waniwani.config.ts.
 * Returns null if the file shape isn't recognized so the caller can fall back
 * to a manual snippet.
 */
function mergeBinding(source: string, binding: Binding): string | null {
	let result = source;

	const orgIdRegex = /(\borgId\s*:\s*)(["'`])([^"'`]*)(\2)/;
	const projectIdRegex = /(\bprojectId\s*:\s*)(["'`])([^"'`]*)(\2)/;

	const hasOrgId = orgIdRegex.test(result);
	const hasProjectId = projectIdRegex.test(result);

	if (hasOrgId) {
		result = result.replace(orgIdRegex, `$1"${binding.orgId}"`);
	}
	if (hasProjectId) {
		result = result.replace(projectIdRegex, `$1"${binding.projectId}"`);
	}

	if (hasOrgId && hasProjectId) return result;

	const insertion = insertIntoDefaultExport(
		result,
		buildInsertion({
			includeOrgId: !hasOrgId,
			includeProjectId: !hasProjectId,
			binding,
		}),
	);

	return insertion;
}

function buildInsertion({
	includeOrgId,
	includeProjectId,
	binding,
}: {
	includeOrgId: boolean;
	includeProjectId: boolean;
	binding: Binding;
}): string {
	const lines: string[] = [];
	if (includeOrgId) lines.push(`\torgId: "${binding.orgId}",`);
	if (includeProjectId) lines.push(`\tprojectId: "${binding.projectId}",`);
	return lines.join("\n");
}

/**
 * Find `export default {` (with optional `defineConfig(` wrapper) and inject
 * `lines` immediately after the opening brace. Returns null if no match.
 */
function insertIntoDefaultExport(source: string, lines: string): string | null {
	if (!lines) return source;

	const patterns = [
		/export\s+default\s+(?:defineConfig\s*\(\s*)?\{/,
		/(?:module\.exports|exports)\s*=\s*\{/,
	];

	for (const pattern of patterns) {
		const match = pattern.exec(source);
		if (!match) continue;
		const insertAt = match.index + match[0].length;
		return `${source.slice(0, insertAt)}\n${lines}${source.slice(insertAt)}`;
	}

	return null;
}
