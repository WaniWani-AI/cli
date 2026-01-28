import { Command } from "commander";
import { auth } from "../lib/auth.js";
import { config } from "../lib/config.js";
import { handleError } from "../lib/errors.js";
import { formatOutput, formatSuccess } from "../lib/output.js";

export const logoutCommand = new Command("logout")
	.description("Log out from WaniWani")
	.action(async (_, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			if (!(await auth.isLoggedIn())) {
				if (json) {
					formatOutput({ alreadyLoggedOut: true }, true);
				} else {
					console.log("Not currently logged in.");
				}
				return;
			}

			// Clear local auth state
			await auth.clear();
			await config.clear();

			if (json) {
				formatOutput({ success: true }, true);
			} else {
				formatSuccess("You have been logged out.", false);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
