import { Command } from "commander";
import { auth } from "../lib/auth.js";
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

			// Clear auth tokens only (keep config like apiUrl intact)
			await auth.clear();

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
