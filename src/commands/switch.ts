import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { CLIError, handleError } from "../lib/errors.js";
import {
	isInquirerCancellation,
	promptForOrg,
	resolveOrg,
	switchToOrg,
} from "../lib/orgs.js";
import { formatOutput, formatSuccess } from "../lib/output.js";
import type { Org, OrgListResponse } from "../types/index.js";
import { ensureLoggedIn } from "./login.js";

export const switchCommand = new Command("switch")
	.description("Switch the active organization")
	.argument("[org]", "Organization name, slug, or ID (prompts if omitted)")
	.action(async (orgArg: string | undefined, _options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			await ensureLoggedIn();

			const spinner = json ? null : ora("Loading organizations...").start();
			const { orgs, activeOrgId } =
				await api.get<OrgListResponse>("/api/oauth/orgs");
			spinner?.stop();

			if (orgs.length === 0) {
				throw new CLIError(
					"You are not a member of any organization.",
					"NO_ORGS",
				);
			}

			let target: Org;
			if (orgArg) {
				target = resolveOrg(orgs, orgArg);
			} else {
				if (json) {
					throw new CLIError(
						"Specify an organization: `waniwani switch <org>`. Interactive selection needs a TTY.",
						"INTERACTIVE_REQUIRED",
					);
				}
				target = await promptForOrg(orgs, activeOrgId);
			}

			const switchSpinner = json
				? null
				: ora(`Switching to ${target.name}...`).start();
			await switchToOrg(target.id);
			switchSpinner?.stop();

			const wasActive = target.id === activeOrgId;
			if (json) {
				formatOutput(
					{ orgId: target.id, org: target.name, alreadyActive: wasActive },
					true,
				);
			} else if (wasActive) {
				formatSuccess(`Active organization: ${chalk.cyan(target.name)}`, false);
			} else {
				formatSuccess(`Switched to ${chalk.cyan(target.name)}`, false);
			}
		} catch (error) {
			if (isInquirerCancellation(error)) {
				console.log();
				console.log(chalk.gray("Cancelled."));
				return;
			}
			handleError(error, json);
			process.exit(1);
		}
	});
