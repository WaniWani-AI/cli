import { Command } from "commander";
import { configInitCommand } from "./init.js";

export const configCommand = new Command("config")
	.description("Manage WaniWani configuration")
	.addCommand(configInitCommand);
