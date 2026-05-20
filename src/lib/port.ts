import { createServer } from "node:net";

export function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.once("listening", () => {
			server.close(() => resolve(true));
		});
		server.listen(port, "127.0.0.1");
	});
}

/**
 * Find the first available port starting at `start`. Increments up to
 * `maxAttempts` times before giving up. Used by `waniwani dev` when the
 * user didn't pass `--port` explicitly, so a busy default doesn't block
 * the readiness poll.
 */
export async function findAvailablePort(
	start: number,
	maxAttempts = 20,
): Promise<number> {
	for (let i = 0; i < maxAttempts; i++) {
		const candidate = start + i;
		if (await isPortAvailable(candidate)) return candidate;
	}
	throw new Error(
		`No available port found in range ${start}-${start + maxAttempts - 1}`,
	);
}
