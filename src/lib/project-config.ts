import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Project-level configuration loaded from `waniwani.config.ts`.
 *
 * Structurally compatible with `WaniWaniProjectConfig` from `@waniwani/sdk`
 * so the CLI can consume the same config file without depending on the SDK.
 */
export interface ProjectConfig {
	/**
	 * The API key to use for the project.
	 */
	apiKey?: string;

	/**
	 * The waniwani API URL to use for the project.
	 *
	 * @default https://app.waniwani.ai
	 */
	apiUrl?: string;
	evals?: {
		dir?: string;
		scenarios?: string;
		mcpServerUrl?: string;
	};
	knowledgeBase?: {
		dir?: string;
	};
}

const DEFAULT_CONFIG_PATH = "waniwani.config.ts";

let _cachedConfig: ProjectConfig | null | undefined; // undefined = not yet loaded

/**
 * Dynamically import a TypeScript/JS module file.
 * Works with bun natively; requires tsx or similar for Node.js.
 */
export async function loadModule<T>(filePath: string): Promise<T> {
	const absPath = resolve(process.cwd(), filePath);
	if (!existsSync(absPath)) {
		throw new Error(`File not found: ${filePath}`);
	}
	const module = await import(pathToFileURL(absPath).href);
	return module.default ?? module;
}

/**
 * Load and cache the project config from `waniwani.config.ts`.
 * Returns `null` if the file does not exist.
 */
export async function loadProjectConfig(
	configPath?: string,
): Promise<ProjectConfig | null> {
	// Skip cache when an explicit path is provided (e.g. eval --config custom.ts)
	if (!configPath && _cachedConfig !== undefined) return _cachedConfig;

	const filePath = configPath ?? DEFAULT_CONFIG_PATH;
	const absPath = resolve(process.cwd(), filePath);

	if (!existsSync(absPath)) {
		if (!configPath) _cachedConfig = null;
		return null;
	}

	const config = await loadModule<ProjectConfig>(absPath);

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
