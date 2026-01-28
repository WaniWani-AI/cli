import { Command } from "commander";
import { listCommand } from "./list.js";
import { switchCommand } from "./switch.js";

export const orgCommand = new Command("org")
	.description("Organization management commands")
	.addCommand(listCommand)
	.addCommand(switchCommand);
