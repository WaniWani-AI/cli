import { Command } from "commander";
import { cloneCommand } from "./clone.js";
import { createCommand } from "./create.js";
import { deleteCommand } from "./delete.js";
import { fileCommand } from "./file/index.js";
import { listCommand } from "./list.js";
import { logsCommand } from "./logs.js";
import { previewCommand } from "./preview.js";
import { runCommandCommand } from "./run-command.js";
import { statusCommand } from "./status.js";
import { stopCommand } from "./stop.js";
import { syncCommand } from "./sync.js";
import { useCommand } from "./use.js";

export const mcpCommand = new Command("mcp")
	.description("MCP management commands")
	.addCommand(createCommand)
	.addCommand(cloneCommand)
	.addCommand(listCommand)
	.addCommand(useCommand)
	.addCommand(statusCommand)
	.addCommand(previewCommand)
	.addCommand(stopCommand)
	.addCommand(logsCommand)
	.addCommand(syncCommand)
	.addCommand(deleteCommand)
	.addCommand(fileCommand)
	.addCommand(runCommandCommand);
