#!/usr/bin/env bun

/**
 * CI check: fetches the generated API client from the app repo and verifies
 * it matches the committed copy. Exits with code 1 if they differ.
 *
 * Usage: bun scripts/check-api-client.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const LOCAL_PATH = resolve(ROOT_DIR, "src/generated/api-client.ts");

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
		`Checking API client against ${config.apiClientRepo}@${config.apiClientRef}...`,
	);

	const remote = await fetchFile(
		config.apiClientRepo,
		config.apiClientRef,
		config.apiClientPath,
	);

	const local = readFileSync(LOCAL_PATH, "utf8");

	if (local === remote) {
		console.log("API client is up to date.");
		return;
	}

	console.error(
		"API client is out of date!\n\n" +
			"The committed src/generated/api-client.ts differs from the one in\n" +
			`${config.apiClientRepo}@${config.apiClientRef}.\n\n` +
			"Run `bun run fetch-api-client` to update it, then commit the result.",
	);
	process.exit(1);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
