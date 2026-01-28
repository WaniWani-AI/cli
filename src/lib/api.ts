import { auth } from "./auth.js";
import { AuthError, CLIError } from "./errors.js";

const API_BASE_URL = process.env.WANIWANI_API_URL || "https://waniwani.com";

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

	const url = `${API_BASE_URL}${path}`;

	const response = await fetch(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	// Handle empty responses (204 No Content)
	if (response.status === 204) {
		return undefined as T;
	}

	const data = (await response.json()) as ApiResponse<T>;

	if (!response.ok || data.error) {
		const error = data.error || {
			code: "API_ERROR",
			message: `Request failed with status ${response.status}`,
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

	getBaseUrl: () => API_BASE_URL,
};
