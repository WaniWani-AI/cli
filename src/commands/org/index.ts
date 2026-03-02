import { Command } from "commander";
import { currentCommand } from "./current.js";
import { listCommand } from "./list.js";
import { switchCommand } from "./switch.js";

export const orgCommand = new Command("org")
	.description("Organization management commands")
	.addCommand(currentCommand)
	.addCommand(listCommand)
	.addCommand(switchCommand);
