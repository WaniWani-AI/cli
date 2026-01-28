import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const CONFIG_DIR = join(homedir(), ".waniwani");
const AUTH_FILE = join(CONFIG_DIR, "auth.json");

const AuthStoreSchema = z.object({
	accessToken: z.string().nullable().default(null),
	refreshToken: z.string().nullable().default(null),
	expiresAt: z.string().nullable().default(null),
});

type AuthStore = z.infer<typeof AuthStoreSchema>;

const API_BASE_URL = process.env.WANIWANI_API_URL || "https://waniwani.com";

async function ensureConfigDir(): Promise<void> {
	await mkdir(CONFIG_DIR, { recursive: true });
}

async function readAuthStore(): Promise<AuthStore> {
	await ensureConfigDir();
	try {
		await access(AUTH_FILE);
		const content = await readFile(AUTH_FILE, "utf-8");
		return AuthStoreSchema.parse(JSON.parse(content));
	} catch {
		return AuthStoreSchema.parse({});
	}
}

async function writeAuthStore(store: AuthStore): Promise<void> {
	await ensureConfigDir();
	await writeFile(AUTH_FILE, JSON.stringify(store, null, 2), "utf-8");
}

class AuthManager {
	private storeCache: AuthStore | null = null;

	private async getStore(): Promise<AuthStore> {
		if (!this.storeCache) {
			this.storeCache = await readAuthStore();
		}
		return this.storeCache;
	}

	private async saveStore(store: AuthStore): Promise<void> {
		this.storeCache = store;
		await writeAuthStore(store);
	}

	async isLoggedIn(): Promise<boolean> {
		const store = await this.getStore();
		return !!store.accessToken;
	}

	async getAccessToken(): Promise<string | null> {
		const store = await this.getStore();
		return store.accessToken;
	}

	async getRefreshToken(): Promise<string | null> {
		const store = await this.getStore();
		return store.refreshToken;
	}

	async setTokens(
		accessToken: string,
		refreshToken: string,
		expiresIn: number,
	): Promise<void> {
		const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
		const store = await this.getStore();
		store.accessToken = accessToken;
		store.refreshToken = refreshToken;
		store.expiresAt = expiresAt;
		await this.saveStore(store);
	}

	async clear(): Promise<void> {
		const emptyStore = AuthStoreSchema.parse({});
		await this.saveStore(emptyStore);
	}

	async isTokenExpired(): Promise<boolean> {
		const store = await this.getStore();
		if (!store.expiresAt) return true;
		// Consider expired 5 minutes before actual expiry
		return new Date(store.expiresAt).getTime() - 5 * 60 * 1000 < Date.now();
	}

	async tryRefreshToken(): Promise<boolean> {
		const refreshToken = await this.getRefreshToken();
		if (!refreshToken) return false;

		try {
			const response = await fetch(`${API_BASE_URL}/api/auth/oauth2/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: refreshToken,
					client_id: "waniwani-cli",
				}).toString(),
			});

			if (!response.ok) {
				await this.clear();
				return false;
			}

			const data = (await response.json()) as {
				access_token: string;
				refresh_token: string;
				expires_in: number;
			};

			await this.setTokens(
				data.access_token,
				data.refresh_token,
				data.expires_in,
			);

			return true;
		} catch {
			await this.clear();
			return false;
		}
	}
}

export const auth = new AuthManager();
