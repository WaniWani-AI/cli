import { Command } from "commander";
import { deleteCommand } from "./delete.js";
import { deployCommand } from "./deploy.js";
import { devCommand } from "./dev.js";
import { fileCommand } from "./file/index.js";
import { initCommand } from "./init.js";
import { listCommand } from "./list.js";
import { logsCommand } from "./logs.js";
import { runCommandCommand } from "./run-command.js";
import { statusCommand } from "./status.js";
import { stopCommand } from "./stop.js";
import { syncCommand } from "./sync.js";
import { useCommand } from "./use.js";

export const mcpCommand = new Command("mcp")
	.description("MCP management commands")
	.addCommand(initCommand)
	.addCommand(listCommand)
	.addCommand(useCommand)
	.addCommand(statusCommand)
	.addCommand(devCommand)
	.addCommand(stopCommand)
	.addCommand(logsCommand)
	.addCommand(syncCommand)
	.addCommand(deployCommand)
	.addCommand(deleteCommand)
	.addCommand(fileCommand)
	.addCommand(runCommandCommand);
