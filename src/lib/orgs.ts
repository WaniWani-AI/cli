import { select } from "@inquirer/prompts";
import chalk from "chalk";
import type { Org } from "../types/index.js";
import { api } from "./api.js";
import { auth } from "./auth.js";
import { CLIError } from "./errors.js";

/**
 * Persist the CLI grant's org binding without touching the current tokens.
 *
 * The switch endpoint stamps the target org onto this grant's refresh token
 * (server-side); the binding rides the grant, so it survives plain refreshes
 * and only an explicit switch changes it. Used right after login, where the
 * just-minted token already represents the active org — so persisting the
 * binding is enough and no refresh is needed. Crucially this never rotates the
 * tokens, so a transient failure can't disturb a freshly issued session.
 *
 * Callers must already be authenticated via OAuth (e.g. via `ensureLoggedIn()`).
 */
export async function bindOrg(orgId: string): Promise<void> {
	await api.post("/api/oauth/orgs/switch", { orgId });
}

/**
 * Switch the CLI's active organization and re-mint the access token for it.
 *
 * Persists the new binding (see {@link bindOrg}), then forces a plain refresh so
 * the stored access token carries the new org's `orgId` claim immediately — no
 * browser, no re-auth. The refresh follows the CLI's normal contract: if it
 * fails the session is cleared, so reserve this for explicit switches where the
 * caller currently holds a token bound to a different org.
 */
export async function switchToOrg(orgId: string): Promise<void> {
	await bindOrg(orgId);
	const refreshed = await auth.tryRefreshToken();
	// A failed refresh clears the stored tokens (logs out). Surface that instead
	// of letting callers report a successful switch over a now-empty session.
	if (!refreshed) {
		throw new CLIError(
			"Switched organization, but the session could not be refreshed. Run `waniwani login` to re-authenticate.",
			"SWITCH_REFRESH_FAILED",
		);
	}
}

/**
 * Interactive org picker. Lists the user's memberships, marks the current one,
 * and resolves to the chosen org. Interactive-only — callers that support
 * `--json` must guard on it first (there's no TTY in that mode).
 */
export async function promptForOrg(
	orgs: Org[],
	activeOrgId: string | null,
): Promise<Org> {
	const orgId = await select<string>({
		message: "Select an organization",
		default: activeOrgId ?? undefined,
		choices: orgs.map((org) => ({
			name:
				org.id === activeOrgId
					? `${org.name} ${chalk.gray("(current)")}`
					: org.name,
			value: org.id,
			description: org.slug,
		})),
	});

	const found = orgs.find((o) => o.id === orgId);
	if (!found) {
		throw new CLIError("Selected organization not found.", "ORG_NOT_FOUND");
	}
	return found;
}

/**
 * Resolve a CLI org argument against the user's memberships. Matches on ID,
 * slug, or name (case-insensitive). Throws on no match or an ambiguous one so
 * the caller never silently switches to the wrong org.
 */
export function resolveOrg(orgs: Org[], orgArg: string): Org {
	const needle = orgArg.trim().toLowerCase();
	const matches = orgs.filter(
		(o) =>
			o.id.toLowerCase() === needle ||
			o.slug.toLowerCase() === needle ||
			o.name.toLowerCase() === needle,
	);
	if (matches.length === 0) {
		throw new CLIError(`No organization matches "${orgArg}".`, "ORG_NOT_FOUND");
	}
	if (matches.length > 1) {
		throw new CLIError(
			`"${orgArg}" matches multiple organizations. Use the slug or ID.`,
			"ORG_AMBIGUOUS",
		);
	}
	return matches[0];
}

/**
 * True when an error is the user cancelling an interactive prompt (Ctrl-C). Lets
 * callers treat a cancelled picker as a no-op rather than a failure.
 */
export function isInquirerCancellation(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return (
		error.name === "ExitPromptError" ||
		error.message.includes("User force closed the prompt")
	);
}
