import { Command } from "commander";
import { createCommand } from "./create.js";
import { deployCommand } from "./deploy.js";
import { listCommand } from "./list.js";
import { listFilesCommand } from "./list-files.js";
import { readFileCommand } from "./read-file.js";
import { runCommandCommand } from "./run-command.js";
import { statusCommand } from "./status.js";
import { stopCommand } from "./stop.js";
import { testCommand } from "./test.js";
import { useCommand } from "./use.js";
import { writeFileCommand } from "./write-file.js";

export const mcpCommand = new Command("mcp")
	.description("MCP sandbox management commands")
	.addCommand(createCommand)
	.addCommand(listCommand)
	.addCommand(useCommand)
	.addCommand(statusCommand)
	.addCommand(stopCommand)
	.addCommand(testCommand)
	.addCommand(deployCommand)
	.addCommand(writeFileCommand)
	.addCommand(readFileCommand)
	.addCommand(listFilesCommand)
	.addCommand(runCommandCommand);
