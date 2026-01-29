import { Command } from "commander";
import { listCommand } from "./list.js";
import { readCommand } from "./read.js";
import { writeCommand } from "./write.js";

export const fileCommand = new Command("file")
	.description("File operations in MCP sandbox")
	.addCommand(readCommand)
	.addCommand(writeCommand)
	.addCommand(listCommand);
