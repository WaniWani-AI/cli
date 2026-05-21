import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import chalk from "chalk";

/**
 * Project-level configuration loaded from `waniwani.json`.
 *
 * Mirrors `WaniWaniProjectConfig` from `@waniwani/sdk` (and the JSON Schema
 * hosted at https://docs.waniwani.ai/waniwani.json) so the CLI can consume the
 * same config file without depending on the SDK.
 */
export interface ProjectConfig {
	/** URL of the JSON Schema for editor autocomplete. Ignored at runtime. */
	$schema?: string;

	/**
	 * Optional API key fallback for legacy `waniwani.config.ts` files.
	 * New projects should set `WANIWANI_API_KEY` in the environment instead.
	 */
	apiKey?: string;

	/**
	 * The waniwani API URL to use for the project.
	 *
	 * @default https://app.waniwani.ai
	 */
	apiUrl?: string;

	/**
	 * WaniWani org ID this project belongs to. Set by `waniwani connect`.
	 */
	orgId?: string;

	/**
	 * WaniWani MCP project ID. Set by `waniwani connect`.
	 */
	projectId?: string;

	/**
	 * Local port the MCP listens on during `waniwani dev`. Overridden by
	 * `--port`. Defaults to 3000.
	 */
	devPort?: number;
}

const JSON_FILENAME = "waniwani.json";
const LEGACY_TS_FILENAME = "waniwani.config.ts";

let _cachedConfig: ProjectConfig | null | undefined; // undefined = not yet loaded
let _legacyWarned = false;

/**
 * Load and cache the project config.
 *
 * Prefers `waniwani.json`; falls back to `waniwani.config.ts` with a one-time
 * deprecation warning. Returns `null` if neither file exists.
 */
export async function loadProjectConfig(
	configPath?: string,
): Promise<ProjectConfig | null> {
	if (!configPath && _cachedConfig !== undefined) return _cachedConfig;

	const config = configPath
		? await loadFromPath(resolve(process.cwd(), configPath))
		: await loadFromDefaults(process.cwd());

	if (!configPath) _cachedConfig = config;
	return config;
}

/**
 * Synchronous read of the cached project config.
 * Returns `null` if `loadProjectConfig()` has not been called or the file was not found.
 */
export function getProjectConfig(): ProjectConfig | null {
	return _cachedConfig ?? null;
}

async function loadFromDefaults(cwd: string): Promise<ProjectConfig | null> {
	const jsonPath = resolve(cwd, JSON_FILENAME);
	if (existsSync(jsonPath)) {
		return parseJsonConfig(jsonPath);
	}

	const tsPath = resolve(cwd, LEGACY_TS_FILENAME);
	if (existsSync(tsPath)) {
		warnLegacyOnce();
		return loadTsConfig(tsPath);
	}

	return null;
}

async function loadFromPath(absPath: string): Promise<ProjectConfig | null> {
	if (!existsSync(absPath)) {
		throw new Error(`File not found: ${absPath}`);
	}
	if (absPath.endsWith(".json")) {
		return parseJsonConfig(absPath);
	}
	if (
		absPath.endsWith(".ts") ||
		absPath.endsWith(".js") ||
		absPath.endsWith(".mjs")
	) {
		warnLegacyOnce();
		return loadTsConfig(absPath);
	}
	throw new Error(`Unsupported config file extension: ${absPath}`);
}

function parseJsonConfig(absPath: string): ProjectConfig {
	const raw = readFileSync(absPath, "utf-8");
	return JSON.parse(raw) as ProjectConfig;
}

async function loadTsConfig(absPath: string): Promise<ProjectConfig> {
	const module = await import(pathToFileURL(absPath).href);
	return (module.default ?? module) as ProjectConfig;
}

function warnLegacyOnce(): void {
	if (_legacyWarned) return;
	_legacyWarned = true;
	console.warn(
		chalk.yellow(
			"waniwani.config.ts is deprecated. Run `waniwani connect` to migrate to waniwani.json " +
				"(https://docs.waniwani.ai/waniwani.json).",
		),
	);
}
