import { execSync } from "node:child_process";
import { input } from "@inquirer/prompts";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { CLIError, handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";
import { findProjectRoot } from "../../lib/sync.js";
import { requireMcpId } from "../../lib/utils.js";
import type { CloneUrlResponse } from "../../types/index.js";

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
				execSync("git rev-parse --is-inside-work-tree", {
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
			const status = execSync("git status --porcelain", {
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

			// Get authenticated clone URL
			const { cloneUrl } = await api.get<CloneUrlResponse>(
				`/api/mcp/repositories/${mcpId}/clone-url`,
			);

			// Stage all changes, commit, and push
			spinner.text = "Committing changes...";
			execSync("git add -A", { cwd: projectRoot, stdio: "ignore" });
			execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
				cwd: projectRoot,
				stdio: "ignore",
			});

			// Temporarily set remote URL with token, push, then reset
			spinner.text = "Pushing to GitHub...";
			const originalUrl = execSync("git remote get-url origin", {
				cwd: projectRoot,
				encoding: "utf-8",
			}).trim();

			try {
				execSync(`git remote set-url origin "${cloneUrl}"`, {
					cwd: projectRoot,
					stdio: "ignore",
				});
				execSync("git push origin HEAD", {
					cwd: projectRoot,
					stdio: "ignore",
				});
			} finally {
				// Always restore the original remote URL
				execSync(`git remote set-url origin "${originalUrl}"`, {
					cwd: projectRoot,
					stdio: "ignore",
				});
			}

			const commitSha = execSync("git rev-parse HEAD", {
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
