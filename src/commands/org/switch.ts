import { Command } from "commander";
import ora from "ora";
import { getClient } from "../../lib/client.js";
import { config } from "../../lib/config.js";
import { CLIError, handleError } from "../../lib/errors.js";
import { formatOutput, formatSuccess } from "../../lib/output.js";

export const switchCommand = new Command("switch")
	.description("Switch to a different organization")
	.argument("<name>", "Name or slug of the organization to switch to")
	.action(async (name: string, _options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			const spinner = ora("Fetching organizations...").start();

			// First fetch orgs to find the org ID
			const client = await getClient();
			const { orgs } = await client.listOrgs();

			// Find org by name or slug
			const org = orgs.find((o) => o.name === name || o.slug === name);

			if (!org) {
				spinner.stop();
				throw new CLIError(
					`Organization "${name}" not found. Run 'waniwani org list' to see available organizations.`,
					"ORG_NOT_FOUND",
				);
			}

			spinner.text = "Switching organization...";

			// Switch to the org
			await client.switchOrg(org.id);

			spinner.succeed("Organization switched");

			// Clear local MCP selection since we switched orgs
			config.setMcpId(null);

			if (json) {
				formatOutput({ switched: org }, true);
			} else {
				formatSuccess(`Switched to organization "${org.name}"`, false);
				console.log();
				console.log("Note: Active MCP selection has been cleared.");
				console.log(
					"Run 'waniwani mcp list' to see MCPs in this organization.",
				);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
