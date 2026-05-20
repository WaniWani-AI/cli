import { auth } from "./auth.js";
import { config } from "./config.js";
import { AuthError, CLIError } from "./errors.js";

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?:
		| string
		| {
				code?: string;
				message?: string;
				details?: Record<string, unknown>;
		  };
	code?: string;
	message?: string;
}

export class ApiError extends CLIError {
	constructor(
		message: string,
		code: string,
		public statusCode: number,
		details?: Record<string, unknown>,
	) {
		super(message, code, details);
		this.name = "ApiError";
	}
}

let _forceOAuth = false;

/**
 * Force subsequent API calls to use OAuth and ignore any `WANIWANI_API_KEY`
 * env var or `apiKey` in `waniwani.config.ts`. Effect persists for the
 * remainder of the process.
 *
 * Use in user-scoped commands (`login`, `connect`, `dev`) — these need the
 * human user's identity, not a project-scoped API key meant for SDK tracking.
 */
export function forceOAuth(): void {
	_forceOAuth = true;
}

async function request<T>(
	method: string,
	path: string,
	options?: {
		body?: unknown;
		requireAuth?: boolean;
		headers?: Record<string, string>;
	},
): Promise<T> {
	const {
		body,
		requireAuth = true,
		headers: extraHeaders = {},
	} = options || {};

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...extraHeaders,
	};

	let usingApiKey = false;

	if (requireAuth) {
		// Try API key first (from env var or waniwani.config.ts), unless the
		// caller explicitly forced OAuth (user-scoped commands).
		const apiKey = _forceOAuth ? undefined : await config.getApiKey();
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
			usingApiKey = true;
		} else {
			// Fall back to OAuth
			const token = await auth.getAccessToken();
			if (!token) {
				throw new AuthError(
					"Not logged in. Run 'waniwani login' to authenticate.",
				);
			}
			headers.Authorization = `Bearer ${token}`;
		}
	}

	const baseUrl = await config.getApiUrl();
	const url = `${baseUrl}${path}`;

	const response = await fetch(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	// Handle empty responses (204 No Content)
	if (response.status === 204) {
		return undefined as T;
	}

	let data: ApiResponse<T>;
	let rawBody: string | undefined;

	try {
		rawBody = await response.text();
		data = JSON.parse(rawBody) as ApiResponse<T>;
	} catch {
		// JSON parsing failed - use raw body as error message
		throw new ApiError(
			rawBody || `Request failed with status ${response.status}`,
			"API_ERROR",
			response.status,
			{ statusText: response.statusText },
		);
	}

	if (!response.ok || data.error) {
		const errorObject =
			typeof data.error === "object" && data.error !== null
				? data.error
				: undefined;
		const errorString = typeof data.error === "string" ? data.error : undefined;

		// Try to extract error message from various possible response formats
		const errorMessage =
			errorObject?.message ||
			data.message ||
			errorString ||
			rawBody ||
			`Request failed with status ${response.status}`;

		const errorCode =
			errorString ||
			errorObject?.code ||
			data.code ||
			data.message ||
			errorObject?.message ||
			"API_ERROR";

		const errorDetails = {
			...errorObject?.details,
			statusText: response.statusText,
			...(errorObject ? {} : { rawResponse: data }),
		};

		const error = {
			code: errorCode,
			message: errorMessage,
			details: errorDetails,
		};

		// Handle token expiration
		if (response.status === 401) {
			if (usingApiKey) {
				throw new AuthError(
					"API key authentication failed. Check your WANIWANI_API_KEY or apiKey in waniwani.config.ts.",
				);
			}
			const refreshed = await auth.tryRefreshToken();
			if (refreshed) {
				// Retry with new token
				return request<T>(method, path, options);
			}
			throw new AuthError(
				"Session expired. Run 'waniwani login' to re-authenticate.",
			);
		}

		throw new ApiError(
			error.message,
			error.code,
			response.status,
			error.details,
		);
	}

	return data.data as T;
}

export const api = {
	get: <T>(path: string, options?: { requireAuth?: boolean }) =>
		request<T>("GET", path, options),

	post: <T>(
		path: string,
		body?: unknown,
		options?: { requireAuth?: boolean; headers?: Record<string, string> },
	) => request<T>("POST", path, { body, ...options }),

	patch: <T>(
		path: string,
		body?: unknown,
		options?: { requireAuth?: boolean; headers?: Record<string, string> },
	) => request<T>("PATCH", path, { body, ...options }),

	delete: <T>(path: string, options?: { requireAuth?: boolean }) =>
		request<T>("DELETE", path, options),

	getBaseUrl: () => config.getApiUrl(),
};
