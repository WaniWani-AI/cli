import { select } from "@inquirer/prompts";
import { config, DEFAULT_API_URL } from "./config.js";
import { CLIError } from "./errors.js";
import { isInquirerCancellation } from "./orgs.js";
import { loadProjectConfig } from "./project-config.js";

/** The WaniWani instances the CLI can connect to. */
export type Region = "us" | "eu";

export interface RegionInfo {
	id: Region;
	label: string;
	apiUrl: string;
}

/** Single source of truth for the instance → URL mapping. */
export const REGIONS: Record<Region, RegionInfo> = {
	us: { id: "us", label: "US", apiUrl: DEFAULT_API_URL },
	eu: { id: "eu", label: "EU", apiUrl: "https://eu.app.waniwani.ai" },
};

/**
 * Map an apiUrl back to its region id. Returns `undefined` for custom or
 * unknown URLs (e.g. a self-hosted instance via `WANIWANI_API_URL`).
 */
export function regionFromApiUrl(apiUrl: string): Region | undefined {
	return Object.values(REGIONS).find((r) => r.apiUrl === apiUrl)?.id;
}

/** Validate a user-supplied region string (case-insensitive). */
function parseRegion(raw: string): Region {
	const normalized = raw.trim().toLowerCase();
	if (normalized === "us" || normalized === "eu") return normalized;
	throw new CLIError(
		`Invalid region "${raw}". Use "us" or "eu".`,
		"INVALID_REGION",
	);
}

/**
 * Ensure the CLI knows which instance to talk to before any authenticated work.
 *
 * Precedence (mirrors `config.getApiUrl()` so the prompt is strictly
 * first-run-only):
 *   a. Explicit `--region` override → validate + persist, no prompt.
 *   b. Already resolved elsewhere (`WANIWANI_API_URL`, project `waniwani.json`
 *      apiUrl, or a previously persisted region) → return it, no prompt.
 *   c. True first run → prompt US/EU, persist the choice, return it.
 *
 * Returns the resolved region, or `undefined` when the target is a custom URL
 * that doesn't map to a known instance.
 */
export async function ensureRegionSelected(
	options: { region?: string } = {},
): Promise<Region | undefined> {
	// a. Explicit override — the caller told us the instance.
	if (options.region) {
		const region = parseRegion(options.region);
		await config.setRegion(region, REGIONS[region].apiUrl);
		return region;
	}

	// b. Already resolved via existing precedence — don't re-ask.
	if (process.env.WANIWANI_API_URL) {
		return regionFromApiUrl(process.env.WANIWANI_API_URL);
	}
	const projectConfig = await loadProjectConfig();
	if (projectConfig?.apiUrl) {
		return regionFromApiUrl(projectConfig.apiUrl);
	}
	const persisted = await config.getRegion();
	if (persisted) return persisted;

	// c. First run — ask which instance to connect to.
	let region: Region;
	try {
		region = await select<Region>({
			message: "Which WaniWani instance do you want to connect to?",
			choices: [
				{
					name: REGIONS.us.label,
					value: "us",
					description: REGIONS.us.apiUrl,
				},
				{
					name: REGIONS.eu.label,
					value: "eu",
					description: REGIONS.eu.apiUrl,
				},
			],
		});
	} catch (error) {
		// Treat Ctrl-C on the very first question as a clean abort.
		if (isInquirerCancellation(error)) process.exit(0);
		throw error;
	}

	await config.setRegion(region, REGIONS[region].apiUrl);
	return region;
}
