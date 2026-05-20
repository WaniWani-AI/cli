import type { DevSession } from "../types/index.js";
import { api } from "./api.js";

const sessionPath = (projectId: string) =>
	`/api/mcp/projects/${projectId}/dev-session`;

const sessionByIdPath = (projectId: string, sessionId: string) =>
	`/api/mcp/projects/${projectId}/dev-session/${sessionId}`;

export const devSessionApi = {
	get: (projectId: string) =>
		api.get<DevSession | null>(sessionPath(projectId)),

	create: (projectId: string, url: string) =>
		api.post<DevSession>(sessionPath(projectId), { url }),

	heartbeat: (projectId: string, sessionId: string) =>
		api.patch<DevSession>(sessionByIdPath(projectId, sessionId)),

	delete: (projectId: string, sessionId: string) =>
		api.delete<void>(sessionByIdPath(projectId, sessionId)),
};
