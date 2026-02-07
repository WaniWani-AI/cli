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
			"No active MCP. Run 'waniwani mcp create <name>' or 'waniwani mcp use <name>'.",
		);
	}
	return configMcpId;
}

/**
 * Get the active session ID from config.
 * Throws McpError if no session ID is stored.
 */
export async function requireSessionId(): Promise<string> {
	const sessionId = await config.getSessionId();

	if (!sessionId) {
		throw new McpError(
			"No active session. Run 'waniwani mcp preview' to start development.",
		);
	}

	return sessionId;
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
