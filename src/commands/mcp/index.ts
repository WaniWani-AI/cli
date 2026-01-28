import { Command } from "commander";
import { createCommand } from "./create.js";
import { deployCommand } from "./deploy.js";
import { listCommand } from "./list.js";
import { statusCommand } from "./status.js";
import { stopCommand } from "./stop.js";
import { testCommand } from "./test.js";
import { useCommand } from "./use.js";

export const mcpCommand = new Command("mcp")
	.description("MCP sandbox management commands")
	.addCommand(createCommand)
	.addCommand(listCommand)
	.addCommand(useCommand)
	.addCommand(statusCommand)
	.addCommand(stopCommand)
	.addCommand(testCommand)
	.addCommand(deployCommand);
