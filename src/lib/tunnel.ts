import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { bin, install } from "cloudflared";

const TUNNEL_READY_TIMEOUT_MS = 30_000;

export interface ActiveTunnel {
	hostname: string;
	publicUrl: string;
	stop: () => void;
}

async function ensureBinary(): Promise<void> {
	if (existsSync(bin)) return;
	await install(bin);
}

/**
 * Run the user's project-scoped Cloudflare named tunnel using a connector
 * token minted by the WaniWani API. The token encodes which tunnel to serve;
 * the ingress (which local port to forward to) was set server-side when the
 * token was issued, so we don't pass `--url` here.
 *
 * Resolves once cloudflared confirms an edge connection — anything earlier
 * would race traffic against connector readiness.
 */
export async function startNamedTunnel(input: {
	hostname: string;
	token: string;
}): Promise<ActiveTunnel> {
	await ensureBinary();

	const child = spawn(
		bin,
		["tunnel", "--no-autoupdate", "run", "--token", input.token],
		{ stdio: ["ignore", "pipe", "pipe"] },
	);

	return new Promise<ActiveTunnel>((resolve, reject) => {
		let settled = false;

		const timeout = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill("SIGTERM");
			reject(
				new Error(
					`cloudflared did not establish a connection within ${TUNNEL_READY_TIMEOUT_MS / 1000}s`,
				),
			);
		}, TUNNEL_READY_TIMEOUT_MS);

		const onReady = (): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			resolve({
				hostname: input.hostname,
				publicUrl: `https://${input.hostname}`,
				stop: () => {
					if (!child.killed) child.kill("SIGTERM");
				},
			});
		};

		const handleChunk = (buf: Buffer): void => {
			// cloudflared logs "Registered tunnel connection" on each successful
			// edge handshake. The first one means the tunnel is serving traffic.
			if (buf.toString().includes("Registered tunnel connection")) {
				onReady();
			}
		};

		child.stdout?.on("data", handleChunk);
		child.stderr?.on("data", handleChunk);

		child.once("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			reject(err);
		});

		child.once("exit", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			reject(
				new Error(
					`cloudflared exited with code ${code ?? "unknown"} before reporting a connection`,
				),
			);
		});
	});
}
