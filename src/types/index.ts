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

export const McpTestResponseSchema = z.object({
	tools: z.array(
		z.object({
			name: z.string(),
			description: z.string().optional(),
			inputSchema: z.record(z.string(), z.unknown()).optional(),
		}),
	),
});

export type McpTestResponse = z.infer<typeof McpTestResponseSchema>;

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
// Task Types
// ============================================

export interface TaskStep {
	type: "text" | "tool_call";
	text?: string;
	tool?: string;
	input?: Record<string, unknown>;
	output?: string;
}

// SSE event types
export const TaskStepEventSchema = z.object({
	type: z.enum(["text", "tool_call"]),
	content: z.string().optional(),
	tool: z.string().optional(),
	input: z.record(z.string(), z.unknown()).optional(),
	output: z.string().optional(),
});

export type TaskStepEvent = z.infer<typeof TaskStepEventSchema>;

export const TaskDoneEventSchema = z.object({
	success: z.boolean(),
	stepCount: z.number(),
	maxStepsReached: z.boolean().optional(),
});

export type TaskDoneEvent = z.infer<typeof TaskDoneEventSchema>;

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
