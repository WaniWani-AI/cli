import { createRequire } from "node:module";
import { Command } from "commander";
import { connectCommand } from "./commands/connect.js";
import { devCommand } from "./commands/dev.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { switchCommand } from "./commands/switch.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export const program = new Command()
	.name("waniwani")
	.description("WaniWani CLI for connecting your repo to a sales agent")
	.version(version)
	.option("--json", "Output results as JSON")
	.option("--verbose", "Enable verbose logging");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(switchCommand);
program.addCommand(connectCommand);
program.addCommand(devCommand);
