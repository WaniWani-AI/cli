import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { loadProjectConfig } from "./project-config.js";

export const LOCAL_CONFIG_DIR = ".waniwani";
export const CONFIG_FILE_NAME = "settings.json";

const LOCAL_DIR = join(process.cwd(), LOCAL_CONFIG_DIR);
const LOCAL_FILE = join(LOCAL_DIR, CONFIG_FILE_NAME);
const DEFAULT_API_URL = "https://app.waniwani.ai";
const CONFIG_DIR_MODE = 0o700;
const CONFIG_FILE_MODE = 0o600;

const ConfigSchema = z.object({
	// Settings
	sessionId: z.string().nullable().default(null),
	mcpId: z.string().nullable().default(null),
	apiUrl: z.string().default(DEFAULT_API_URL),
	// Auth (merged from auth.json)
	accessToken: z.string().nullable().default(null),
	refreshToken: z.string().nullable().default(null),
	expiresAt: z.string().nullable().default(null),
	clientId: z.string().nullable().default(null),
});

type ConfigData = z.infer<typeof ConfigSchema>;

class Config {
	private dir: string;
	private file: string;
	private cache: ConfigData | null = null;

	constructor() {
		this.dir = LOCAL_DIR;
		this.file = LOCAL_FILE;
	}

	private async setSecurePermissions(): Promise<void> {
		await chmod(this.dir, CONFIG_DIR_MODE);
		await chmod(this.file, CONFIG_FILE_MODE);
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
		await mkdir(this.dir, { recursive: true, mode: CONFIG_DIR_MODE });
		await writeFile(this.file, JSON.stringify(data, null, "\t"));
		await this.setSecurePermissions();
	}

	/**
	 * Ensure the .waniwani directory exists in cwd.
	 * Used by login to create config before saving tokens.
	 */
	async ensureConfigDir(): Promise<void> {
		await mkdir(this.dir, { recursive: true, mode: CONFIG_DIR_MODE });
		await chmod(this.dir, CONFIG_DIR_MODE);
	}

	/**
	 * Check if a .waniwani config directory exists in cwd.
	 */
	hasConfig(): boolean {
		return existsSync(this.dir);
	}

	// --- Settings methods ---

	async getMcpId() {
		return (await this.load()).mcpId;
	}

	async setMcpId(id: string | null) {
		const data = await this.load();
		data.mcpId = id;
		await this.save(data);
	}

	async getSessionId() {
		return (await this.load()).sessionId;
	}

	async setSessionId(id: string | null) {
		const data = await this.load();
		data.sessionId = id;
		await this.save(data);
	}

	async getApiUrl() {
		if (process.env.WANIWANI_API_URL) return process.env.WANIWANI_API_URL;
		const projectConfig = await loadProjectConfig();
		if (projectConfig?.apiUrl) return projectConfig.apiUrl;
		return (await this.load()).apiUrl;
	}

	async getApiKey(): Promise<string | null> {
		if (process.env.WANIWANI_API_KEY) return process.env.WANIWANI_API_KEY;
		const projectConfig = await loadProjectConfig();
		return projectConfig?.apiKey ?? null;
	}

	async clear() {
		await this.save(ConfigSchema.parse({}));
	}

	// --- Auth methods ---

	async getAccessToken(): Promise<string | null> {
		return (await this.load()).accessToken;
	}

	async getRefreshToken(): Promise<string | null> {
		return (await this.load()).refreshToken;
	}

	async getClientId(): Promise<string | null> {
		return (await this.load()).clientId;
	}

	async setTokens(
		accessToken: string,
		refreshToken: string,
		expiresIn: number,
		clientId?: string,
	): Promise<void> {
		const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
		const data = await this.load();
		data.accessToken = accessToken;
		data.refreshToken = refreshToken;
		data.expiresAt = expiresAt;
		if (clientId) {
			data.clientId = clientId;
		}
		await this.save(data);
	}

	async clearAuth(): Promise<void> {
		const data = await this.load();
		data.accessToken = null;
		data.refreshToken = null;
		data.expiresAt = null;
		data.clientId = null;
		await this.save(data);
	}

	async isTokenExpired(): Promise<boolean> {
		const data = await this.load();
		if (!data.expiresAt) return true;
		// Consider expired 5 minutes before actual expiry
		return new Date(data.expiresAt).getTime() - 5 * 60 * 1000 < Date.now();
	}
}

export const config = new Config();

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

	await mkdir(configDir, { recursive: true, mode: CONFIG_DIR_MODE });

	const data = ConfigSchema.parse(overrides);
	await writeFile(configPath, JSON.stringify(data, null, "\t"), "utf-8");
	await chmod(configDir, CONFIG_DIR_MODE);
	await chmod(configPath, CONFIG_FILE_MODE);

	return { path: configPath, config: data };
}
