import type { McpRepository } from "../types/index.js";
import { api } from "./api.js";
import { config } from "./config.js";
import { McpError } from "./errors.js";

/**
 * Requires an MCP ID, falling back to the active MCP from config.
 * Throws McpError if no MCP is available.
 */
export async function requireMcpId(mcpId?: string): Promise<string> {
	if (mcpId) return mcpId;

	const configMcpId = await config.getMcpId();
	if (!configMcpId) {
		throw new McpError(
			"No active MCP. Run 'waniwani mcp init <name>' or 'waniwani mcp use <name>'.",
		);
	}
	return configMcpId;
}

/**
 * Get the active session ID for an MCP repository.
 * Checks config first, validates with API, falls back to repository.
 * Throws McpError if no active session exists.
 */
export async function requireSessionId(mcpId: string): Promise<string> {
	// Check stored sessionId
	const storedSessionId = await config.getSessionId();

	if (storedSessionId) {
		// Validate it's still valid
		try {
			await api.post(`/api/mcp/sessions/${storedSessionId}/server`, {
				action: "status",
			});
			return storedSessionId;
		} catch {
			// Session invalid, clear and fallback
			await config.setSessionId(null);
		}
	}

	// Fetch from repository
	const repository = await api.get<McpRepository>(
		`/api/mcp/repositories/${mcpId}`,
	);

	if (!repository.activeSandbox) {
		throw new McpError(
			"No active session. Run 'waniwani mcp dev' to start development.",
		);
	}

	// Store for future use
	await config.setSessionId(repository.activeSandbox.id);
	return repository.activeSandbox.id;
}

/**
 * Debounce a function to limit how often it can be called
 */
// biome-ignore lint/suspicious/noExplicitAny: Necessary for generic debounce
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
}

/**
 * Binary file extensions that should be base64 encoded
 */
const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".ico",
	".webp",
	".svg",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".otf",
	".zip",
	".tar",
	".gz",
	".pdf",
	".exe",
	".dll",
	".so",
	".dylib",
	".bin",
	".mp3",
	".mp4",
	".wav",
	".ogg",
	".webm",
]);

/**
 * Check if a file path is likely a binary file based on extension
 */
export function isBinaryPath(filePath: string): boolean {
	const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
	return BINARY_EXTENSIONS.has(ext);
}

/**
 * Detect if a buffer contains binary data by checking for null bytes
 */
export function detectBinary(buffer: Buffer): boolean {
	// Check first 8KB for null bytes
	const sample = buffer.subarray(0, 8192);
	return sample.includes(0);
}
