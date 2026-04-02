import { Command } from "commander";
import { ingestCommand } from "./ingest.js";
import { searchCommand } from "./search.js";
import { sourcesCommand } from "./sources.js";

export const kbCommand = new Command("kb")
	.description("Knowledge base commands")
	.addCommand(ingestCommand)
	.addCommand(sourcesCommand)
	.addCommand(searchCommand);
