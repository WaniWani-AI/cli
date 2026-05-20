import { createServer } from "node:net";

export function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.once("listening", () => {
			server.close(() => resolve(true));
		});
		// Bind to the wildcard (matches how Next.js / most Node servers bind),
		// so an existing process on `::` or `0.0.0.0` is correctly detected as a
		// conflict. Binding to 127.0.0.1 misses IPv6-wildcard listeners.
		server.listen(port);
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
