import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const PROJECT_CONFIG_DIR = ".waniwani";
const PROJECT_CONFIG_FILE = "settings.local.json";

export const ProjectConfigSchema = z.object({
	mcpId: z.string().optional(),
	defaults: z
		.object({
			model: z.string().optional(),
			maxSteps: z.number().optional(),
		})
		.optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

let projectConfigCache: ProjectConfig | null | undefined;

function getProjectConfigPath(): string {
	return join(process.cwd(), PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
}

function getProjectConfigDir(): string {
	return join(process.cwd(), PROJECT_CONFIG_DIR);
}

export function hasProjectConfig(): boolean {
	return existsSync(getProjectConfigDir());
}

export async function loadProjectConfig(): Promise<ProjectConfig | null> {
	if (projectConfigCache !== undefined) {
		return projectConfigCache;
	}

	const configPath = getProjectConfigPath();

	try {
		const content = await readFile(configPath, "utf-8");
		projectConfigCache = ProjectConfigSchema.parse(JSON.parse(content));
		return projectConfigCache;
	} catch {
		// Config file doesn't exist or is invalid - that's fine
		projectConfigCache = null;
		return null;
	}
}

export async function saveProjectConfig(
	config: Partial<ProjectConfig>,
): Promise<void> {
	const configDir = getProjectConfigDir();
	const configPath = getProjectConfigPath();

	// Ensure .waniwani directory exists
	await mkdir(configDir, { recursive: true });

	// Merge with existing config
	const existing = (await loadProjectConfig()) ?? {};
	const merged = ProjectConfigSchema.parse({ ...existing, ...config });

	await writeFile(configPath, JSON.stringify(merged, null, "\t"), "utf-8");

	// Update cache
	projectConfigCache = merged;
}

export function clearProjectConfigCache(): void {
	projectConfigCache = undefined;
}
