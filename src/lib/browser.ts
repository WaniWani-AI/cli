import { spawn } from "node:child_process";

export async function openBrowser(url: string): Promise<void> {
	const [cmd, ...args] =
		process.platform === "darwin"
			? ["open", url]
			: process.platform === "win32"
				? ["cmd", "/c", "start", url]
				: ["xdg-open", url];

	spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}
