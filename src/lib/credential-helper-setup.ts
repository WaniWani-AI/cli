import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/**
 * Configure git credential helper in a repository's local .git/config.
 * Uses the absolute path to the current CLI binary to avoid PATH issues.
 */
export function setupGitCredentialHelper(repoDir: string): void {
	const binaryPath = realpathSync(process.argv[1]);
	const helperCommand = `!${process.execPath} ${binaryPath} git-credential-helper`;

	execFileSync(
		"git",
		["config", "--local", "credential.helper", helperCommand],
		{ cwd: repoDir, stdio: "ignore" },
	);
}
