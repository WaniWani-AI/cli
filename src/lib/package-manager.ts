import { existsSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export function detectPackageManager(cwd: string): PackageManager {
	if (existsSync(join(cwd, "bun.lock"))) return "bun";
	if (existsSync(join(cwd, "bun.lockb"))) return "bun";
	if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
	return "npm";
}

export function devCommand(pm: PackageManager): [string, string[]] {
	switch (pm) {
		case "bun":
			return ["bun", ["run", "dev"]];
		case "pnpm":
			return ["pnpm", ["dev"]];
		case "yarn":
			return ["yarn", ["dev"]];
		case "npm":
			return ["npm", ["run", "dev"]];
	}
}
