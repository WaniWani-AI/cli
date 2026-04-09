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
		// Try OAuth token first (works with all endpoints)
		const token = await auth.getAccessToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		} else {
			// Fall back to API key (only works with MCP endpoints)
			const apiKey = await config.getApiKey();
			if (apiKey) {
				headers.Authorization = `Bearer ${apiKey}`;
				usingApiKey = true;
			} else {
				throw new AuthError(
					"Not logged in. Run 'waniwani login' to authenticate.",
				);
			}
		}
	}

	const canFallbackToApiKey =
		requireAuth && !usingApiKey && (await config.getApiKey()) !== null;

	const baseUrl = await config.getApiUrl();
	const url = `${baseUrl}${path}`;

	let response = await fetch(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	// On 401 with OAuth token, try refresh then fall back to API key
	if (response.status === 401 && requireAuth && !usingApiKey) {
		const refreshed = await auth.tryRefreshToken();
		if (refreshed) {
			const newToken = await auth.getAccessToken();
			if (newToken) {
				headers.Authorization = `Bearer ${newToken}`;
				response = await fetch(url, {
					method,
					headers,
					body: body ? JSON.stringify(body) : undefined,
				});
			}
		}

		if (response.status === 401 && canFallbackToApiKey) {
			const apiKey = await config.getApiKey();
			headers.Authorization = `Bearer ${apiKey}`;
			usingApiKey = true;
			response = await fetch(url, {
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
			});
		}
	}

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

		if (response.status === 401) {
			if (usingApiKey) {
				throw new AuthError(
					"API key authentication failed. Check your WANIWANI_API_KEY or apiKey in waniwani.config.ts.",
				);
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

	delete: <T>(path: string, options?: { requireAuth?: boolean }) =>
		request<T>("DELETE", path, options),

	getBaseUrl: () => config.getApiUrl(),
};
