import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { handleError } from "../../lib/errors.js";
import { formatList, formatOutput } from "../../lib/output.js";
import type { Org, OrgListResponse } from "../../types/index.js";

export const currentCommand = new Command("current")
	.description("Show the current active organization")
	.action(async (_options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching current organization...").start();

			const result = await api.get<OrgListResponse>("/api/oauth/orgs");

			spinner.stop();

			const { orgs, activeOrgId } = result;

			if (!activeOrgId) {
				if (json) {
					formatOutput({ org: null }, true);
				} else {
					console.log("No active organization.");
					console.log(
						"\nSwitch to an organization: waniwani org switch <name>",
					);
				}
				return;
			}

			const activeOrg = orgs.find((o: Org) => o.id === activeOrgId);

			if (!activeOrg) {
				if (json) {
					formatOutput({ org: null }, true);
				} else {
					console.log("Active organization not found.");
					console.log(
						"\nSwitch to an organization: waniwani org switch <name>",
					);
				}
				return;
			}

			if (json) {
				formatOutput({ org: activeOrg }, true);
			} else {
				console.log();
				formatList(
					[
						{ label: "Name", value: activeOrg.name },
						{ label: "Slug", value: activeOrg.slug },
						{ label: "Role", value: activeOrg.role },
					],
					false,
				);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
