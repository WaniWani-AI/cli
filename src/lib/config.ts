import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { loadProjectConfig } from "./project-config.js";

const CONFIG_DIR = join(homedir(), ".waniwani");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const ConfigSchema = z.object({
	defaults: z
		.object({
			model: z.string().default("claude-sonnet-4-20250514"),
			maxSteps: z.number().default(10),
		})
		.default(() => ({ model: "claude-sonnet-4-20250514", maxSteps: 10 })),
	activeMcpId: z.string().nullable().default(null),
});

type Config = z.infer<typeof ConfigSchema>;

async function ensureConfigDir(): Promise<void> {
	await mkdir(CONFIG_DIR, { recursive: true });
}

async function readConfig(): Promise<Config> {
	await ensureConfigDir();
	try {
		await access(CONFIG_FILE);
		const content = await readFile(CONFIG_FILE, "utf-8");
		return ConfigSchema.parse(JSON.parse(content));
	} catch {
		return ConfigSchema.parse({});
	}
}

async function writeConfig(config: Config): Promise<void> {
	await ensureConfigDir();
	await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

class ConfigManager {
	private configCache: Config | null = null;

	private async getConfig(): Promise<Config> {
		if (!this.configCache) {
			this.configCache = await readConfig();
		}
		return this.configCache;
	}

	private async saveConfig(config: Config): Promise<void> {
		this.configCache = config;
		await writeConfig(config);
	}

	async getDefaults(): Promise<Config["defaults"]> {
		const config = await this.getConfig();
		return config.defaults;
	}

	async getEffectiveDefaults(): Promise<Config["defaults"]> {
		const globalConfig = await this.getConfig();
		const projectConfig = await loadProjectConfig();

		return {
			...globalConfig.defaults,
			...projectConfig?.defaults,
		};
	}

	async getEffectiveMcpId(): Promise<string | null> {
		const projectConfig = await loadProjectConfig();
		if (projectConfig?.mcpId) {
			return projectConfig.mcpId;
		}
		return this.getActiveMcpId();
	}

	async setDefaults(defaults: Partial<Config["defaults"]>): Promise<void> {
		const config = await this.getConfig();
		config.defaults = { ...config.defaults, ...defaults };
		await this.saveConfig(config);
	}

	async getActiveMcpId(): Promise<string | null> {
		const config = await this.getConfig();
		return config.activeMcpId;
	}

	async setActiveMcpId(id: string | null): Promise<void> {
		const config = await this.getConfig();
		config.activeMcpId = id;
		await this.saveConfig(config);
	}

	async clear(): Promise<void> {
		const emptyConfig = ConfigSchema.parse({});
		await this.saveConfig(emptyConfig);
	}
}

export const config = new ConfigManager();
