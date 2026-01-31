import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const LOCAL_CONFIG_DIR = ".waniwani";
export const CONFIG_FILE_NAME = "settings.json";

const LOCAL_DIR = join(process.cwd(), LOCAL_CONFIG_DIR);
const LOCAL_FILE = join(LOCAL_DIR, CONFIG_FILE_NAME);
const GLOBAL_DIR = join(homedir(), LOCAL_CONFIG_DIR);
const GLOBAL_FILE = join(GLOBAL_DIR, CONFIG_FILE_NAME);
const DEFAULT_API_URL = "https://app.waniwani.ai";

const ConfigSchema = z.object({
	mcp: z.object({
		id: z.string().nullable().default(null),
		name: z.string().nullable().default(null),
	}),
	apiUrl: z.string().default(DEFAULT_API_URL),
});

type ConfigData = z.infer<typeof ConfigSchema>;

class Config {
	private dir: string;
	private file: string;
	private cache: ConfigData | null = null;
	readonly scope: "local" | "global";

	constructor(forceGlobal = false) {
		const useLocal = !forceGlobal && existsSync(LOCAL_DIR);
		this.dir = useLocal ? LOCAL_DIR : GLOBAL_DIR;
		this.file = useLocal ? LOCAL_FILE : GLOBAL_FILE;
		this.scope = useLocal ? "local" : "global";
	}

	private async load(): Promise<ConfigData> {
		if (!this.cache) {
			try {
				this.cache = ConfigSchema.parse(
					JSON.parse(await readFile(this.file, "utf-8")),
				);
			} catch {
				this.cache = ConfigSchema.parse({});
			}
		}
		return this.cache;
	}

	private async save(data: ConfigData): Promise<void> {
		this.cache = data;
		await mkdir(this.dir, { recursive: true });
		await writeFile(this.file, JSON.stringify(data, null, "\t"));
	}

	async getMcpId() {
		return (await this.load()).mcp.id;
	}

	async setMcpId(id: string | null) {
		const data = await this.load();
		data.mcp.id = id;
		await this.save(data);
	}

	async getApiUrl() {
		if (process.env.WANIWANI_API_URL) return process.env.WANIWANI_API_URL;
		return (await this.load()).apiUrl;
	}

	async clear() {
		await this.save(ConfigSchema.parse({}));
	}
}

export const config = new Config();
export const globalConfig = new Config(true);

/**
 * Initialize a .waniwani/settings.json at the given directory.
 * Returns the created config data and path.
 */
export async function initConfigAt(
	dir: string,
	overrides: Partial<ConfigData> = {},
): Promise<{ path: string; config: ConfigData }> {
	const configDir = join(dir, LOCAL_CONFIG_DIR);
	const configPath = join(configDir, CONFIG_FILE_NAME);

	await mkdir(configDir, { recursive: true });

	const data = ConfigSchema.parse(overrides);
	await writeFile(configPath, JSON.stringify(data, null, "\t"), "utf-8");

	return { path: configPath, config: data };
}
