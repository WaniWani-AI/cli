#!/usr/bin/env bun

/**
 * Fetches the generated API client from the WaniWani app repo on GitHub.
 *
 * Configuration (in package.json under "waniwani"):
 *   - apiClientRepo: GitHub repo (default: "WaniWani-AI/app")
 *   - apiClientRef:  Git ref / branch (default: "deploy/prod")
 *   - apiClientPath: Path in the repo (default: "src/generated/cli-api-client.ts")
 *
 * Usage: bun scripts/fetch-api-client.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const OUTPUT_PATH = resolve(ROOT_DIR, "src/generated/api-client.ts");

interface WaniWaniConfig {
	apiClientRepo?: string;
	apiClientRef?: string;
	apiClientPath?: string;
}

function loadConfig(): Required<WaniWaniConfig> {
	const pkgPath = resolve(ROOT_DIR, "package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	const config: WaniWaniConfig = pkg.waniwani ?? {};

	return {
		apiClientRepo: config.apiClientRepo ?? "WaniWani-AI/app",
		apiClientRef: config.apiClientRef ?? "deploy/prod",
		apiClientPath:
			config.apiClientPath ?? "src/generated/cli-api-client.ts",
	};
}

async function fetchFile(
	repo: string,
	ref: string,
	path: string,
): Promise<string> {
	const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
	console.log(`Fetching ${url}`);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch API client: ${response.status} ${response.statusText}\n` +
				`  URL: ${url}\n` +
				`  Make sure the ref "${ref}" exists and the file is committed.`,
		);
	}
	return response.text();
}

async function main() {
	const config = loadConfig();

	console.log(
		`Fetching API client from ${config.apiClientRepo}@${config.apiClientRef}`,
	);

	const content = await fetchFile(
		config.apiClientRepo,
		config.apiClientRef,
		config.apiClientPath,
	);

	const dir = dirname(OUTPUT_PATH);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	writeFileSync(OUTPUT_PATH, content, "utf8");
	console.log(`Written to src/generated/api-client.ts`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
