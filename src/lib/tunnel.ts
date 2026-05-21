import { existsSync } from "node:fs";
import { bin, install, Tunnel } from "cloudflared";

const TUNNEL_READY_TIMEOUT_MS = 30_000;

export interface ActiveTunnel {
	publicUrl: string;
	stop: () => void;
}

async function ensureBinary(): Promise<void> {
	if (existsSync(bin)) return;
	await install(bin);
}

/**
 * Start a Cloudflare quick tunnel pointing at the given local URL and resolve
 * once the public `https://*.trycloudflare.com` URL has been printed. The
 * caller is responsible for invoking `stop()` on shutdown — the tunnel keeps
 * a child `cloudflared` process alive otherwise.
 */
export async function startQuickTunnel(
	localUrl: string,
): Promise<ActiveTunnel> {
	await ensureBinary();

	const tunnel = Tunnel.quick(localUrl);

	return new Promise<ActiveTunnel>((resolve, reject) => {
		const timeout = setTimeout(() => {
			tunnel.stop();
			reject(
				new Error(
					`Cloudflare tunnel did not report a public URL within ${TUNNEL_READY_TIMEOUT_MS / 1000}s`,
				),
			);
		}, TUNNEL_READY_TIMEOUT_MS);

		tunnel.once("url", (url) => {
			clearTimeout(timeout);
			resolve({
				publicUrl: url,
				stop: () => {
					tunnel.stop();
				},
			});
		});

		tunnel.once("error", (err) => {
			clearTimeout(timeout);
			tunnel.stop();
			reject(err);
		});

		tunnel.once("exit", (code) => {
			clearTimeout(timeout);
			if (code !== 0 && code !== null) {
				reject(new Error(`cloudflared exited with code ${code}`));
			}
		});
	});
}
