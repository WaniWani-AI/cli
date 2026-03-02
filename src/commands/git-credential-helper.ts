import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { CONFIG_FILE_NAME, LOCAL_CONFIG_DIR } from "../lib/config.js";
import { getGitAuthContext } from "../lib/git-auth.js";
import { findProjectRoot } from "../lib/sync.js";

/**
 * Parse git credential helper input from stdin.
 * Format: key=value lines, terminated by an empty line.
 */
function parseCredentialInput(input: string): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const line of input.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx > 0) {
			fields[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
		}
	}
	return fields;
}

export const gitCredentialHelperCommand = new Command("git-credential-helper")
	.description("Git credential helper (used by git, not called directly)")
	.argument("<operation>", "get, store, or erase")
	.action(async (operation: string) => {
		// Only handle "get" — "store" and "erase" are no-ops
		if (operation !== "get") {
			process.exit(0);
		}

		try {
			// Read credential request from stdin
			const input = readFileSync(0, "utf-8");
			const fields = parseCredentialInput(input);

			// Only handle HTTPS
			if (fields.protocol && fields.protocol !== "https") {
				process.exit(0);
			}

			// Find project root
			const projectRoot = await findProjectRoot(process.cwd());
			if (!projectRoot) {
				process.stderr.write(
					"waniwani: not in a WaniWani project (no .waniwani/ found)\n",
				);
				process.exit(1);
			}

			// Read mcpId directly from config file
			const configPath = join(projectRoot, LOCAL_CONFIG_DIR, CONFIG_FILE_NAME);
			const configData = JSON.parse(readFileSync(configPath, "utf-8"));
			const mcpId = configData.mcpId;

			if (!mcpId) {
				process.stderr.write("waniwani: no mcpId in config\n");
				process.exit(1);
			}

			// Get ephemeral credentials
			const gitAuth = await getGitAuthContext(mcpId);

			if (!gitAuth.credentials) {
				process.stderr.write("waniwani: no credentials returned from API\n");
				process.exit(1);
			}

			// Output in git credential helper format
			process.stdout.write(
				`username=${gitAuth.credentials.username}\npassword=${gitAuth.credentials.password}\n`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`waniwani credential helper error: ${message}\n`);
			process.exit(1);
		}
	});
