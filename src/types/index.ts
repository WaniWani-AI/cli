import { z } from "zod";

// OAuth

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

// Organizations

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

// MCP Projects

export const McpProjectHostingSchema = z.enum(["managed", "external"]);
export type McpProjectHosting = z.infer<typeof McpProjectHostingSchema>;

export const McpProjectSchema = z.object({
	id: z.string(),
	orgId: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	hosting: McpProjectHostingSchema,
	mcpRepositoryId: z.string().nullable().optional(),
	defaultEnvironmentId: z.string().nullable().optional(),
	repository: z
		.object({
			githubRepo: z.string().optional(),
			githubCloneUrl: z.string().optional(),
			productionUrl: z.string().nullable().optional(),
		})
		.partial()
		.optional(),
});
export type McpProject = z.infer<typeof McpProjectSchema>;

export const McpProjectListResponseSchema = z.array(McpProjectSchema);
export type McpProjectListResponse = z.infer<
	typeof McpProjectListResponseSchema
>;

export const CreateMcpProjectResponseSchema = McpProjectSchema.extend({
	vercelKeySyncFailed: z.boolean().optional(),
	productionApiKey: z.string().nullable().optional(),
});
export type CreateMcpProjectResponse = z.infer<
	typeof CreateMcpProjectResponseSchema
>;

// Dev sessions

export const DevSessionSchema = z.object({
	id: z.string(),
	// Public hostname of the project's stable Cloudflare named tunnel — null
	// only for projects predating `mcp_local_tunnels`. The CLI logs this for
	// the user; the chat route reads it from the server when routing playground
	// traffic to local.
	hostname: z.string().nullable(),
	lastHeartbeatAt: z.string(),
});
export type DevSession = z.infer<typeof DevSessionSchema>;
