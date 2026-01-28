import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { handleError } from "../../lib/errors.js";
import { formatOutput, formatTable } from "../../lib/output.js";
import type { Org, OrgListResponse } from "../../types/index.js";

export const listCommand = new Command("list")
	.description("List your organizations")
	.action(async (_, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching organizations...").start();

			const result = await api.get<OrgListResponse>("/api/oauth/orgs");

			spinner.stop();

			const { orgs, activeOrgId } = result;

			if (json) {
				formatOutput(
					{
						orgs: orgs.map((o: Org) => ({
							...o,
							isActive: o.id === activeOrgId,
						})),
						activeOrgId,
					},
					true,
				);
			} else {
				if (orgs.length === 0) {
					console.log("No organizations found.");
					return;
				}

				console.log(chalk.bold("\nOrganizations:\n"));

				const rows = orgs.map((o: Org) => {
					const isActive = o.id === activeOrgId;
					return [
						isActive ? chalk.cyan(`* ${o.name}`) : `  ${o.name}`,
						o.slug,
						o.role,
					];
				});

				formatTable(["Name", "Slug", "Role"], rows, false);

				console.log();
				if (activeOrgId) {
					const activeOrg = orgs.find((o: Org) => o.id === activeOrgId);
					if (activeOrg) {
						console.log(`Active organization: ${chalk.cyan(activeOrg.name)}`);
					}
				}
				console.log("\nSwitch organization: waniwani org switch <name>");
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
