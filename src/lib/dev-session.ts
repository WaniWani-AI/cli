import type { DevSession } from "../types/index.js";
import { api } from "./api.js";

const sessionPath = (projectId: string) =>
	`/api/mcp/projects/${projectId}/dev-session`;

const sessionByIdPath = (projectId: string, sessionId: string) =>
	`/api/mcp/projects/${projectId}/dev-session/${sessionId}`;

export const devSessionApi = {
	get: (projectId: string) =>
		api.get<DevSession | null>(sessionPath(projectId)),

	// No payload — the dev session is a pure liveness signal now. The
	// project's public hostname comes back in the response (`hostname` field),
	// sourced from `mcp_local_tunnels` on the server.
	create: (projectId: string) =>
		api.post<DevSession>(sessionPath(projectId), {}),

	heartbeat: (projectId: string, sessionId: string) =>
		api.patch<DevSession>(sessionByIdPath(projectId, sessionId)),

	delete: (projectId: string, sessionId: string) =>
		api.delete<void>(sessionByIdPath(projectId, sessionId)),
};
