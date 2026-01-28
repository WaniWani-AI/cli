import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const LOCAL_DIR = join(process.cwd(), ".waniwani");
const LOCAL_FILE = join(LOCAL_DIR, "settings.json");
const GLOBAL_DIR = join(homedir(), ".waniwani");
const GLOBAL_FILE = join(GLOBAL_DIR, "settings.json");
const DEFAULT_API_URL = "https://app.waniwani.ai";

const ConfigSchema = z.object({
	defaults: z
		.object({ model: z.string(), maxSteps: z.number() })
		.default({ model: "claude-sonnet-4-20250514", maxSteps: 10 }),
	mcpId: z.string().nullable().default(null),
	apiUrl: z.string().nullable().default(null),
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

	async getDefaults() {
		return (await this.load()).defaults;
	}

	async setDefaults(defaults: Partial<ConfigData["defaults"]>) {
		const data = await this.load();
		data.defaults = { ...data.defaults, ...defaults };
		await this.save(data);
	}

	async getMcpId() {
		return (await this.load()).mcpId;
	}

	async setMcpId(id: string | null) {
		const data = await this.load();
		data.mcpId = id;
		await this.save(data);
	}

	async getApiUrl() {
		if (process.env.WANIWANI_API_URL) return process.env.WANIWANI_API_URL;
		return (await this.load()).apiUrl || DEFAULT_API_URL;
	}

	async setApiUrl(url: string | null) {
		const data = await this.load();
		data.apiUrl = url;
		await this.save(data);
	}

	async clear() {
		await this.save(ConfigSchema.parse({}));
	}
}

export const config = new Config();
export const globalConfig = new Config(true);
