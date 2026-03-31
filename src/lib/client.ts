import {
	WaniWaniApiClient,
	WaniWaniApiError,
} from "../generated/api-client.js";
import { auth } from "./auth.js";
import { config } from "./config.js";
import { AuthError } from "./errors.js";

export { WaniWaniApiError };
export type { WaniWaniApiClient };

let _client: WaniWaniApiClient | null = null;

/**
 * Returns a WaniWaniApiClient instance configured with auth.
 *
 * The client injects Bearer tokens via a custom fetch wrapper and
 * automatically retries once on 401 after refreshing the token.
 */
export async function getClient(): Promise<WaniWaniApiClient> {
	if (_client) return _client;

	const baseUrl = await config.getApiUrl();

	const authedFetch: typeof fetch = async (input, init) => {
		const token = await auth.getAccessToken();
		if (!token) {
			throw new AuthError(
				"Not logged in. Run 'waniwani login' to authenticate.",
			);
		}

		const headers = new Headers(init?.headers);
		headers.set("Authorization", `Bearer ${token}`);

		const response = await fetch(input, { ...init, headers });

		if (response.status === 401) {
			const refreshed = await auth.tryRefreshToken();
			if (!refreshed) {
				throw new AuthError(
					"Session expired. Run 'waniwani login' to re-authenticate.",
				);
			}
			const newToken = await auth.getAccessToken();
			if (!newToken) {
				throw new AuthError(
					"Session expired. Run 'waniwani login' to re-authenticate.",
				);
			}
			headers.set("Authorization", `Bearer ${newToken}`);
			return fetch(input, { ...init, headers });
		}

		return response;
	};

	_client = new WaniWaniApiClient({ baseUrl, fetch: authedFetch });
	return _client;
}

/** Reset the cached client (e.g. after login/logout). */
export function resetClient(): void {
	_client = null;
}
