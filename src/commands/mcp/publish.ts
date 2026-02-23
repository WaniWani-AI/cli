import { execFileSync } from "node:child_process";
import { input } from "@inquirer/prompts";
import { Command } from "commander";
import ora from "ora";
import { CLIError, handleError } from "../../lib/errors.js";
import {
	getGitAuthContext,
	revokeGitHubInstallationToken,
	runGitWithCredentials,
} from "../../lib/git-auth.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { findProjectRoot } from "../../lib/sync.js";
import { requireMcpId } from "../../lib/utils.js";

export const publishCommand = new Command("publish")
	.description("Push local files to GitHub and trigger deployment")
	.option("-m, --message <msg>", "Commit message")
	.option("--mcp-id <id>", "Specific MCP ID")
	.action(async (options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const mcpId = await requireMcpId(options.mcpId);

			// Find project root
			const projectRoot = await findProjectRoot(process.cwd());
			if (!projectRoot) {
				throw new CLIError(
					"Not in a WaniWani project. Run 'waniwani mcp create <name>' first.",
					"NOT_IN_PROJECT",
				);
			}

			// Check this is a git repo
			try {
				execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
					cwd: projectRoot,
					stdio: "ignore",
				});
			} catch {
				throw new CLIError(
					"Not a git repository. Run 'waniwani mcp create <name>' or 'waniwani mcp clone <name>' to set up properly.",
					"NOT_GIT_REPO",
				);
			}

			// Check if there are changes to commit
			const status = execFileSync("git", ["status", "--porcelain"], {
				cwd: projectRoot,
				encoding: "utf-8",
			}).trim();

			if (!status) {
				if (json) {
					formatOutput({ success: true, message: "Nothing to publish" }, true);
				} else {
					console.log("Nothing to publish — no changes detected.");
				}
				return;
			}

			// Get commit message
			let message = options.message;
			if (!message) {
				message = await input({
					message: "Commit message:",
					validate: (value) =>
						value.trim() ? true : "Commit message is required",
				});
			}

			const spinner = ora("Publishing...").start();
			const gitAuth = await getGitAuthContext(mcpId);

			// Stage all changes, commit, and push
			spinner.text = "Committing changes...";
			execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
			execFileSync("git", ["commit", "-m", message], {
				cwd: projectRoot,
				stdio: "ignore",
			});

			// Push with ephemeral credentials without mutating origin URL
			spinner.text = "Pushing to GitHub...";
			try {
				runGitWithCredentials(["push", gitAuth.remoteUrl, "HEAD"], {
					cwd: projectRoot,
					stdio: "ignore",
					credentials: gitAuth.credentials,
				});
			} finally {
				await revokeGitHubInstallationToken(gitAuth);
			}

			const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: projectRoot,
				encoding: "utf-8",
			}).trim();

			spinner.succeed(`Pushed to GitHub (${commitSha.slice(0, 7)})`);

			if (json) {
				formatOutput({ commitSha, message }, true);
			} else {
				console.log();
				formatSuccess("Files pushed to GitHub!", false);
				console.log();
				console.log("Deployment will start automatically via webhook.");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
