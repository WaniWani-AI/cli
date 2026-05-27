import { api } from "./api.js";

/**
 * Request payload for `POST /api/mcp/projects/[id]/tunnel`. The server uses
 * `port` to repoint Cloudflare's ingress at the developer's currently-running
 * local MCP, then returns a connector token plus the stable public hostname.
 */
export interface TunnelStartPayload {
	port: number;
}

export interface TunnelStartResponse {
	hostname: string;
	token: string;
}

const tunnelPath = (projectId: string): string =>
	`/api/mcp/projects/${projectId}/tunnel`;

export const tunnelApi = {
	start: (projectId: string, payload: TunnelStartPayload) =>
		api.post<TunnelStartResponse>(tunnelPath(projectId), payload),
};
