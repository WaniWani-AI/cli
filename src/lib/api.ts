import { auth } from "./auth.js";
import { config } from "./config.js";
import { AuthError, CLIError } from "./errors.js";

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
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

	if (requireAuth) {
		const token = await auth.getAccessToken();
		if (!token) {
			throw new AuthError(
				"Not logged in. Run 'waniwani login' to authenticate.",
			);
		}
		headers.Authorization = `Bearer ${token}`;
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
		// Try to extract error message from various possible response formats
		const errorMessage =
			data.error?.message ||
			(data as unknown as { message?: string }).message ||
			(data as unknown as { error?: string }).error ||
			rawBody ||
			`Request failed with status ${response.status}`;

		const errorCode =
			data.error?.code ||
			(data as unknown as { code?: string }).code ||
			"API_ERROR";

		const errorDetails = {
			...data.error?.details,
			statusText: response.statusText,
			...(data.error ? {} : { rawResponse: data }),
		};

		const error = {
			code: errorCode,
			message: errorMessage,
			details: errorDetails,
		};

		// Handle token expiration
		if (response.status === 401) {
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

	delete: <T>(path: string, options?: { requireAuth?: boolean }) =>
		request<T>("DELETE", path, options),

	getBaseUrl: () => config.getApiUrl(),
};
