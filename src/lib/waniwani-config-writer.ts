import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const JSON_FILENAME = "waniwani.json";
const TS_FILENAME = "waniwani.config.ts";
const SCHEMA_URL = "https://app.waniwani.ai/waniwani.json";

export interface WriteBindingResult {
	path: string;
	created: boolean;
	updated: boolean;
	/** Path of the legacy `waniwani.config.ts` we removed, if any. */
	removedLegacy?: string;
	/** Set when the existing JSON file shape isn't recognized. */
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
	const jsonPath = join(cwd, JSON_FILENAME);
	const tsPath = join(cwd, TS_FILENAME);
	const hasJson = existsSync(jsonPath);
	const hasTs = existsSync(tsPath);

	if (hasJson) {
		const original = await readFile(jsonPath, "utf-8");
		const merged = mergeIntoJson(original, binding);

		if (!merged) {
			return {
				path: jsonPath,
				created: false,
				updated: false,
				manualSnippet: renderJsonSnippet(binding),
			};
		}

		if (merged !== original) {
			await writeFile(jsonPath, merged, "utf-8");
		}

		const removedLegacy = await maybeRemoveLegacy(tsPath, hasTs);
		return {
			path: jsonPath,
			created: false,
			updated: merged !== original,
			removedLegacy,
		};
	}

	await writeFile(jsonPath, renderNewJson(binding), "utf-8");
	const removedLegacy = await maybeRemoveLegacy(tsPath, hasTs);
	return {
		path: jsonPath,
		created: true,
		updated: false,
		removedLegacy,
	};
}

async function maybeRemoveLegacy(
	tsPath: string,
	hasTs: boolean,
): Promise<string | undefined> {
	if (!hasTs) return undefined;
	await unlink(tsPath);
	return tsPath;
}

function renderNewJson(binding: Binding): string {
	const body = {
		$schema: SCHEMA_URL,
		orgId: binding.orgId,
		projectId: binding.projectId,
	};
	return `${JSON.stringify(body, null, 2)}\n`;
}

function renderJsonSnippet(binding: Binding): string {
	return `\t"orgId": "${binding.orgId}",\n\t"projectId": "${binding.projectId}"`;
}

/**
 * Merge orgId/projectId into an existing `waniwani.json`.
 *
 * Tries to preserve formatting by round-tripping through JSON.parse only when
 * needed. Returns null if parsing fails so the caller can fall back to a
 * manual snippet.
 */
function mergeIntoJson(source: string, binding: Binding): string | null {
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(source);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			return null;
		}
	} catch {
		return null;
	}

	const rest = { ...parsed };
	const existingSchema = rest.$schema;
	delete rest.$schema;
	delete rest.orgId;
	delete rest.projectId;

	const next: Record<string, unknown> = {
		$schema: typeof existingSchema === "string" ? existingSchema : SCHEMA_URL,
		...rest,
		orgId: binding.orgId,
		projectId: binding.projectId,
	};

	return `${JSON.stringify(next, null, 2)}\n`;
}
