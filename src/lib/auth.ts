import { config } from "./config.js";

/**
 * AuthManager delegates all storage to the config module.
 * Auth tokens are stored in .waniwani/settings.json alongside other config.
 */
class AuthManager {
	async isLoggedIn(): Promise<boolean> {
		const token = await config.getAccessToken();
		if (!token) return false;
		// Detect env drift: tokens issued for a different apiUrl than we'd
		// currently target. Treat as logged-out so the caller re-logs in
		// against the correct env.
		const tokenApiUrl = await config.getTokenApiUrl();
		const currentApiUrl = await config.getApiUrl();
		if (tokenApiUrl !== currentApiUrl) return false;
		return true;
	}

	async getAccessToken(): Promise<string | null> {
		return config.getAccessToken();
	}

	async getRefreshToken(): Promise<string | null> {
		return config.getRefreshToken();
	}

	async setTokens(
		accessToken: string,
		refreshToken: string,
		expiresIn: number,
		clientId?: string,
		apiUrl?: string,
	): Promise<void> {
		return config.setTokens(
			accessToken,
			refreshToken,
			expiresIn,
			clientId,
			apiUrl,
		);
	}

	async clear(): Promise<void> {
		return config.clearAuth();
	}

	async isTokenExpired(): Promise<boolean> {
		return config.isTokenExpired();
	}

	async tryRefreshToken(): Promise<boolean> {
		const refreshToken = await config.getRefreshToken();
		const clientId = await config.getClientId();
		if (!refreshToken || !clientId) return false;

		try {
			const apiUrl = await config.getApiUrl();
			const response = await fetch(`${apiUrl}/api/auth/oauth2/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: refreshToken,
					client_id: clientId,
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
