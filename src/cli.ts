import { createRequire } from "node:module";
import { Command } from "commander";
import { configCommand } from "./commands/config/index.js";
import { evalCommand } from "./commands/eval.js";
import { gitCredentialHelperCommand } from "./commands/git-credential-helper.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { mcpCommand } from "./commands/mcp/index.js";
import { orgCommand } from "./commands/org/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export const program = new Command()
	.name("waniwani")
	.description("WaniWani CLI for MCP development workflow")
	.version(version)
	.option("--json", "Output results as JSON")
	.option("--verbose", "Enable verbose logging");

// Auth commands
program.addCommand(loginCommand);
program.addCommand(logoutCommand);

// Main commands
program.addCommand(mcpCommand);
program.addCommand(orgCommand);
program.addCommand(configCommand);
program.addCommand(evalCommand);

// Git integration (called by git, not users)
program.addCommand(gitCredentialHelperCommand);
