import chalk from "chalk";
import { ZodError } from "zod";

export class CLIError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "CLIError";
	}
}

export class ConfigError extends CLIError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "CONFIG_ERROR", details);
	}
}

export class AuthError extends CLIError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "AUTH_ERROR", details);
	}
}

export class SandboxError extends CLIError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "SANDBOX_ERROR", details);
	}
}

export class GitHubError extends CLIError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "GITHUB_ERROR", details);
	}
}

export class McpError extends CLIError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "MCP_ERROR", details);
	}
}

export function handleError(error: unknown, json: boolean): void {
	if (error instanceof ZodError) {
		const message = error.issues
			.map((e) => `${e.path.join(".")}: ${e.message}`)
			.join(", ");
		outputError("VALIDATION_ERROR", `Invalid input: ${message}`, json);
	} else if (error instanceof CLIError) {
		outputError(error.code, error.message, json, error.details);
	} else if (error instanceof Error) {
		outputError("UNKNOWN_ERROR", error.message, json);
	} else {
		outputError("UNKNOWN_ERROR", String(error), json);
	}
}

function outputError(
	code: string,
	message: string,
	json: boolean,
	details?: Record<string, unknown>,
): void {
	if (json) {
		console.error(
			JSON.stringify({ success: false, error: { code, message, details } }),
		);
	} else {
		console.error(chalk.red(`Error [${code}]:`), message);
		if (details) {
			console.error(chalk.gray("Details:"), JSON.stringify(details, null, 2));
		}
	}
}
