import { z } from "zod";

// ============================================
// OAuth 2.1 Token Response
// ============================================

export const OAuthTokenResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string(),
	expires_in: z.number(),
	token_type: z.string().optional(),
});

export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;

export const OAuthClientRegistrationResponseSchema = z.object({
	client_id: z.string(),
	client_secret: z.string().optional(),
	client_id_issued_at: z.number().optional(),
	client_secret_expires_at: z.number().optional(),
});

export type OAuthClientRegistrationResponse = z.infer<
	typeof OAuthClientRegistrationResponseSchema
>;

// ============================================
// MCP Types
// ============================================

export const McpSchema = z.object({
	id: z.string(),
	orgId: z.string(),
	createdBy: z.string(),
	name: z.string(),
	sandboxId: z.string(),
	previewUrl: z.string().url(),
	status: z.enum(["active", "stopped", "expired"]),
	createdAt: z.string(),
	expiresAt: z.string().nullable(),
	stoppedAt: z.string().nullable(),
});

export type Mcp = z.infer<typeof McpSchema>;

// MCP list response (array of MCPs)
export const McpListResponseSchema = z.array(McpSchema);

export type McpListResponse = z.infer<typeof McpListResponseSchema>;

// Create MCP response (returns the created MCP)
export const CreateMcpResponseSchema = McpSchema;

export type CreateMcpResponse = z.infer<typeof CreateMcpResponseSchema>;

// ============================================
// MCP Tool Types
// ============================================

export interface McpTool {
	name: string;
	description: string;
	inputSchema?: Record<string, unknown>;
}

export interface McpToolResult {
	tool: string;
	input: Record<string, unknown>;
	result: unknown;
	duration: number;
}

export const McpCallResponseSchema = z.object({
	result: z.unknown(),
	duration: z.number(),
});

export type McpCallResponse = z.infer<typeof McpCallResponseSchema>;

// ============================================
// Deploy Types
// ============================================

export const DeployResponseSchema = z.object({
	repository: z.object({
		url: z.string().url(),
		fullName: z.string(),
		owner: z.string(),
		name: z.string(),
	}),
	deployment: z.object({
		url: z.string().url().optional(),
		status: z.string(),
		note: z.string().optional(),
	}),
});

export type DeployResponse = z.infer<typeof DeployResponseSchema>;

// ============================================
// Organization Types
// ============================================

export const OrgSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	role: z.string(),
});

export type Org = z.infer<typeof OrgSchema>;

export const OrgListResponseSchema = z.object({
	orgs: z.array(OrgSchema),
	activeOrgId: z.string().nullable(),
});

export type OrgListResponse = z.infer<typeof OrgListResponseSchema>;

export const OrgSwitchResponseSchema = z.object({
	orgId: z.string(),
});

export type OrgSwitchResponse = z.infer<typeof OrgSwitchResponseSchema>;

// ============================================
// Command Result Types
// ============================================

export interface CommandResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

// ============================================
// Sandbox File/Command Operation Types
// ============================================

// Write files
export const WriteFilesResponseSchema = z.object({
	written: z.array(z.string()),
});
export type WriteFilesResponse = z.infer<typeof WriteFilesResponseSchema>;

// Read file
export const ReadFileResponseSchema = z.object({
	path: z.string(),
	content: z.string(),
	encoding: z.enum(["utf8", "base64"]),
	exists: z.boolean(),
});
export type ReadFileResponse = z.infer<typeof ReadFileResponseSchema>;

// List files
export const ListFilesResponseSchema = z.object({
	path: z.string(),
	entries: z.array(
		z.object({
			name: z.string(),
			type: z.enum(["file", "directory"]),
			size: z.number().optional(),
		}),
	),
});
export type ListFilesResponse = z.infer<typeof ListFilesResponseSchema>;

// Run command
export const RunCommandResponseSchema = z.object({
	exitCode: z.number(),
	stdout: z.string(),
	stderr: z.string(),
	duration: z.number(),
});
export type RunCommandResponse = z.infer<typeof RunCommandResponseSchema>;

// ============================================
// Server Lifecycle Types
// ============================================

// Server status response
export const ServerStatusResponseSchema = z.object({
	running: z.boolean(),
	cmdId: z.string().optional(),
	previewUrl: z.string().optional(),
});
export type ServerStatusResponse = z.infer<typeof ServerStatusResponseSchema>;

// Server start response
export const ServerStartResponseSchema = z.object({
	cmdId: z.string(),
	previewUrl: z.string(),
});
export type ServerStartResponse = z.infer<typeof ServerStartResponseSchema>;

// Server stop response
export const ServerStopResponseSchema = z.object({
	stopped: z.boolean(),
});
export type ServerStopResponse = z.infer<typeof ServerStopResponseSchema>;

// Log streaming event types
export const LogEventSchema = z.object({
	stream: z.enum(["stdout", "stderr"]).optional(),
	data: z.string().optional(),
	cmdId: z.string().optional(),
	exitCode: z.number().optional(),
	error: z.string().optional(),
});
export type LogEvent = z.infer<typeof LogEventSchema>;

// ============================================
// Pull Files Types (for init)
// ============================================

// Recursive file listing - returns all files with their content
export const PullFilesResponseSchema = z.object({
	files: z.array(
		z.object({
			path: z.string(), // Relative path from sandbox root (e.g., "src/index.ts")
			content: z.string(),
			encoding: z.enum(["utf8", "base64"]),
		}),
	),
});
export type PullFilesResponse = z.infer<typeof PullFilesResponseSchema>;
