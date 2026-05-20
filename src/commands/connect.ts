import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { CLIError, handleError } from "../lib/errors.js";
import { formatSuccess } from "../lib/output.js";
import { loadProjectConfig } from "../lib/project-config.js";
import {
	type WriteBindingResult,
	writeBinding,
} from "../lib/waniwani-config-writer.js";
import type {
	CreateMcpProjectResponse,
	McpProject,
	McpProjectListResponse,
	OrgListResponse,
} from "../types/index.js";
import { ensureLoggedIn } from "./login.js";

const CREATE_MANAGED = "__create_managed__";
const CREATE_EXTERNAL = "__create_external__";

export const connectCommand = new Command("connect")
	.description("Connect this repo to a WaniWani agent (or create a new one)")
	.action(async (_options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			if (json) {
				throw new CLIError(
					"`waniwani connect` is interactive only. Run it without --json.",
					"INTERACTIVE_REQUIRED",
				);
			}

			await ensureLoggedIn();

			const existing = await loadProjectConfig();

			if (existing?.projectId) {
				const proceed = await handleExistingBinding(existing.projectId);
				if (!proceed) return;
			}

			const { project, binding } = await runConnectFlow();

			console.log();
			if (binding.manualSnippet) {
				console.log(
					chalk.yellow(
						"Could not auto-update waniwani.config.ts. Add these lines to your default export:",
					),
				);
				console.log();
				console.log(chalk.cyan(binding.manualSnippet));
				console.log();
			} else if (binding.created) {
				formatSuccess(`Created ${binding.path}`, false);
			} else if (binding.updated) {
				formatSuccess(`Updated ${binding.path}`, false);
			} else {
				formatSuccess(`${binding.path} already up to date`, false);
			}

			printNextSteps(project);
		} catch (error) {
			if (isInquirerCancellation(error)) {
				console.log();
				console.log(chalk.gray("Cancelled."));
				return;
			}
			handleError(error, json);
			process.exit(1);
		}
	});

/**
 * Pure interactive flow: pick an org, pick or create a project, write the
 * binding to `waniwani.config.ts`. Used by `connect` and `dev` commands.
 *
 * Side effects: prompts the user, hits the API, writes a file. Does NOT print
 * "success"-style messages — callers own their UX.
 */
export async function runConnectFlow(): Promise<{
	orgId: string;
	project: McpProject;
	binding: WriteBindingResult;
}> {
	const orgId = await pickOrg();
	const project = await pickOrCreateProject(orgId);
	const binding = await writeBinding(process.cwd(), {
		orgId,
		projectId: project.id,
	});
	return { orgId, project, binding };
}

async function handleExistingBinding(projectId: string): Promise<boolean> {
	const project = await fetchProject(projectId);
	if (!project) {
		console.log(
			chalk.yellow(
				`waniwani.config.ts references project ${projectId} but it could not be found. Re-running connect.`,
			),
		);
		return true;
	}

	console.log();
	console.log(
		`Already connected to ${chalk.cyan(project.name)} ${chalk.gray(`(hosting: ${project.hosting})`)}`,
	);

	const switchProject = await confirm({
		message: "Switch to a different project?",
		default: false,
	});

	if (!switchProject) {
		console.log(chalk.gray("Nothing to do."));
	}

	return switchProject;
}

async function fetchProject(projectId: string): Promise<McpProject | null> {
	try {
		const projects = await api.get<McpProjectListResponse>("/api/mcp/projects");
		return projects.find((p) => p.id === projectId) ?? null;
	} catch {
		return null;
	}
}

async function pickOrg(): Promise<string> {
	const spinner = ora("Loading organizations...").start();
	const { orgs, activeOrgId } =
		await api.get<OrgListResponse>("/api/oauth/orgs");
	spinner.stop();

	if (orgs.length === 0) {
		throw new CLIError("You are not a member of any organization.", "NO_ORGS");
	}

	if (orgs.length === 1) {
		const only = orgs[0];
		console.log(`Organization: ${chalk.cyan(only.name)}`);
		if (activeOrgId !== only.id) {
			await switchOrg(only.id);
		}
		return only.id;
	}

	const orgId = await select<string>({
		message: "Select an organization",
		default: activeOrgId ?? undefined,
		choices: orgs.map((org) => ({
			name: org.name,
			value: org.id,
			description: org.slug,
		})),
	});

	if (orgId !== activeOrgId) {
		await switchOrg(orgId);
	}
	return orgId;
}

async function switchOrg(orgId: string): Promise<void> {
	await api.post("/api/oauth/orgs/switch", { orgId });
}

async function pickOrCreateProject(orgId: string): Promise<McpProject> {
	const spinner = ora("Loading agents...").start();
	const projects = await api.get<McpProjectListResponse>("/api/mcp/projects");
	spinner.stop();

	const choice = await select<string>({
		message: "Select an agent",
		choices: [
			...projects.map((p) => ({
				name: `${p.name} ${chalk.gray(`(${p.hosting})`)}`,
				value: p.id,
			})),
			{
				name: chalk.green("+ Create new managed agent (we host the repo)"),
				value: CREATE_MANAGED,
			},
			{
				name: chalk.green("+ Create new external agent (you host the server)"),
				value: CREATE_EXTERNAL,
			},
		],
	});

	if (choice === CREATE_MANAGED) {
		return createManaged(orgId);
	}
	if (choice === CREATE_EXTERNAL) {
		return createExternal(orgId);
	}

	const selected = projects.find((p) => p.id === choice);
	if (!selected) {
		throw new CLIError("Selected project not found.", "PROJECT_NOT_FOUND");
	}
	return selected;
}

async function createManaged(_orgId: string): Promise<McpProject> {
	const name = await input({
		message: "Name for the new managed agent",
		validate: (value) => value.trim().length > 0 || "Name must not be empty",
	});

	const spinner = ora("Provisioning GitHub repo and Vercel project...").start();
	try {
		const project = await api.post<CreateMcpProjectResponse>(
			"/api/mcp/projects",
			{
				name: name.trim(),
				hosting: "managed",
			},
		);
		spinner.succeed(`Created managed agent "${project.name}"`);

		if (project.vercelKeySyncFailed) {
			console.log(
				chalk.yellow(
					"  Warning: Vercel env var sync failed. Check the dashboard before deploying.",
				),
			);
		}

		const githubRepo = project.repository?.githubRepo;
		if (githubRepo) {
			console.log(
				`  GitHub: ${chalk.cyan(`https://github.com/${githubRepo}`)}`,
			);
		}

		return project;
	} catch (error) {
		spinner.fail("Failed to create managed agent");
		throw error;
	}
}

async function createExternal(_orgId: string): Promise<McpProject> {
	const name = await input({
		message: "Name for the new external agent",
		validate: (value) => value.trim().length > 0 || "Name must not be empty",
	});

	const url = await input({
		message: "Production URL of your hosted MCP server (optional)",
		default: "",
	});

	const spinner = ora("Creating external agent...").start();
	try {
		const project = await api.post<CreateMcpProjectResponse>(
			"/api/mcp/projects",
			{
				name: name.trim(),
				hosting: "external",
				...(url.trim() ? { url: url.trim() } : {}),
			},
		);
		spinner.succeed(`Created external agent "${project.name}"`);

		const apiKey = project.productionApiKey;
		if (apiKey) {
			console.log();
			console.log(
				chalk.bold.yellow(
					"  Production API key (save this now — it will not be shown again):",
				),
			);
			console.log(`  ${chalk.cyan(apiKey)}`);
			console.log();
			console.log(
				chalk.gray(
					"  Suggested: export WANIWANI_API_KEY=... in your hosted server.",
				),
			);
		}

		return project;
	} catch (error) {
		spinner.fail("Failed to create external agent");
		throw error;
	}
}

function printNextSteps(project: McpProject): void {
	console.log();
	if (project.hosting === "external") {
		console.log("Next steps:");
		console.log(
			"  • Wire the API key into your hosted server (e.g. WANIWANI_API_KEY env var)",
		);
		console.log(
			"  • Update the Production environment URL in the WaniWani dashboard if you skipped it",
		);
	} else {
		console.log("Next steps:");
		console.log("  • Edit your agent at https://app.waniwani.ai");
		console.log(
			"  • Pushes to the tracked branch deploy automatically via Vercel",
		);
	}
}

function isInquirerCancellation(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return (
		error.name === "ExitPromptError" ||
		error.message.includes("User force closed the prompt")
	);
}
