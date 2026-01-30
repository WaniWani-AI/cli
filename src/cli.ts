import { Command } from "commander";
import { devCommand } from "./commands/dev.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { mcpCommand } from "./commands/mcp/index.js";
import { orgCommand } from "./commands/org/index.js";
import { pushCommand } from "./commands/push.js";
import { taskCommand } from "./commands/task.js";

const version = "0.1.0";

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
program.addCommand(initCommand);
program.addCommand(pushCommand);
program.addCommand(devCommand);
program.addCommand(mcpCommand);
program.addCommand(taskCommand);
program.addCommand(orgCommand);
