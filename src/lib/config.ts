import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { loadProjectConfig } from "./project-config.js";

const CONFIG_DIR = join(homedir(), ".waniwani");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_API_URL = "https://app.waniwani.ai";

const ConfigSchema = z.object({
	defaults: z
		.object({ model: z.string(), maxSteps: z.number() })
		.default({ model: "claude-sonnet-4-20250514", maxSteps: 10 }),
	activeMcpId: z.string().nullable().default(null),
	apiUrl: z.string().nullable().default(null),
});

type Config = z.infer<typeof ConfigSchema>;

let cache: Config | null = null;

async function load(): Promise<Config> {
	if (cache) return cache;
	try {
		cache = ConfigSchema.parse(JSON.parse(await readFile(CONFIG_FILE, "utf-8")));
	} catch {
		cache = ConfigSchema.parse({});
	}
	return cache;
}

async function save(cfg: Config): Promise<void> {
	cache = cfg;
	await mkdir(CONFIG_DIR, { recursive: true });
	await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

async function update(fn: (cfg: Config) => void): Promise<void> {
	const cfg = await load();
	fn(cfg);
	await save(cfg);
}

export const config = {
	getDefaults: async () => {
		const cfg = await load();
		return cfg.defaults;
	},

	getEffectiveDefaults: async () => {
		const global = await load();
		const project = await loadProjectConfig();
		return { ...global.defaults, ...project?.defaults };
	},

	setDefaults: (defaults: Partial<Config["defaults"]>) => {
		return update((cfg) => (cfg.defaults = { ...cfg.defaults, ...defaults }));
	},

	getActiveMcpId: async () => {
		const cfg = await load();
		return cfg.activeMcpId;
	},

	getEffectiveMcpId: async () => {
		const project = await loadProjectConfig();
		if (project?.mcpId) return project.mcpId;
		const cfg = await load();
		return cfg.activeMcpId;
	},

	setActiveMcpId: (id: string | null) => {
		return update((cfg) => (cfg.activeMcpId = id));
	},

	getApiUrl: async () => {
		if (process.env.WANIWANI_API_URL) return process.env.WANIWANI_API_URL;
		const cfg = await load();
		return cfg.apiUrl || DEFAULT_API_URL;
	},

	setApiUrl: (url: string | null) => {
		return update((cfg) => (cfg.apiUrl = url));
	},

	clear: () => {
		return save(ConfigSchema.parse({}));
	},
};
