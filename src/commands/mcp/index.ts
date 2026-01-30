import { Command } from "commander";
import { deleteCommand } from "./delete.js";
import { deployCommand } from "./deploy.js";
import { fileCommand } from "./file/index.js";
import { listCommand } from "./list.js";
import { logsCommand } from "./logs.js";
import { runCommandCommand } from "./run-command.js";
import { startCommand } from "./start.js";
import { statusCommand } from "./status.js";
import { stopCommand } from "./stop.js";
import { useCommand } from "./use.js";

export const mcpCommand = new Command("mcp")
	.description("MCP sandbox management commands")
	.addCommand(listCommand)
	.addCommand(useCommand)
	.addCommand(statusCommand)
	.addCommand(startCommand)
	.addCommand(stopCommand)
	.addCommand(logsCommand)
	.addCommand(deleteCommand)
	.addCommand(deployCommand)
	.addCommand(fileCommand)
	.addCommand(runCommandCommand);
