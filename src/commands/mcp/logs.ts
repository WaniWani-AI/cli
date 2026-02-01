import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../../lib/api.js";
import { auth } from "../../lib/auth.js";
import { AuthError, handleError, McpError } from "../../lib/errors.js";
import { formatOutput } from "../../lib/output.js";
import { requireMcpId, requireSessionId } from "../../lib/utils.js";
import type { LogEvent, ServerStatusResponse } from "../../types/index.js";

export const logsCommand = new Command("logs")
	.description("Stream logs from the MCP server")
	.argument("[cmdId]", "Command ID (defaults to running server)")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("-f, --follow", "Keep streaming logs (default)", true)
	.option("--no-follow", "Fetch logs and exit")
	.action(async (cmdIdArg: string | undefined, options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

		// Handle Ctrl+C gracefully
		const cleanup = () => {
			if (reader) {
				reader.cancel().catch(() => {});
			}
			process.exit(0);
		};
		process.on("SIGINT", cleanup);
		process.on("SIGTERM", cleanup);

		try {
			await requireMcpId(options.mcpId);
			const sessionId = await requireSessionId();

			const token = await auth.getAccessToken();
			if (!token) {
				throw new AuthError(
					"Not logged in. Run 'waniwani login' to authenticate.",
				);
			}

			let cmdId = cmdIdArg;

			// If no cmdId provided, get it from server status
			if (!cmdId) {
				const spinner = ora("Getting server status...").start();
				const status = await api.post<ServerStatusResponse>(
					`/api/mcp/sessions/${sessionId}/server`,
					{ action: "status" },
				);
				spinner.stop();

				if (!status.running || !status.cmdId) {
					throw new McpError(
						"No server is running. Run 'waniwani mcp dev' first.",
					);
				}
				cmdId = status.cmdId;
			}

			const baseUrl = await api.getBaseUrl();
			const streamParam = options.follow ? "?stream=true" : "";
			const url = `${baseUrl}/api/mcp/sessions/${sessionId}/commands/${cmdId}${streamParam}`;

			if (!json) {
				console.log(chalk.gray(`Streaming logs for command ${cmdId}...`));
				console.log(chalk.gray("Press Ctrl+C to stop\n"));
			}

			const response = await fetch(url, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: options.follow ? "text/event-stream" : "application/json",
				},
			});

			if (!response.ok) {
				const error = await response
					.json()
					.catch(() => ({ message: response.statusText }));
				throw new Error(
					error.message || `Request failed with status ${response.status}`,
				);
			}

			// Non-streaming mode
			if (!options.follow) {
				const data = await response.json();
				if (json) {
					formatOutput(data, true);
				} else {
					if (data.stdout) {
						process.stdout.write(data.stdout);
					}
					if (data.stderr) {
						process.stderr.write(chalk.red(data.stderr));
					}
					if (data.exitCode !== undefined) {
						console.log(chalk.gray(`\nExit code: ${data.exitCode}`));
					}
				}
				return;
			}

			// Streaming mode
			reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body");
			}

			const decoder = new TextDecoder();
			let buffer = "";
			const collectedLogs: LogEvent[] = [];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (line.startsWith("event: ")) {
						continue;
					}

					if (line.startsWith("data: ")) {
						const data = line.slice(6);
						if (!data || data === "[DONE]") continue;

						try {
							const event = JSON.parse(data) as LogEvent;
							collectedLogs.push(event);

							if (json) {
								// In JSON mode, we'll output at the end
								continue;
							}

							// Handle different event types
							if (event.cmdId) {
								// Initial event with cmdId
								continue;
							}

							if (event.stream && event.data !== undefined) {
								if (event.stream === "stdout") {
									process.stdout.write(event.data);
								} else if (event.stream === "stderr") {
									process.stderr.write(chalk.red(event.data));
								}
							}

							if (event.exitCode !== undefined) {
								const exitColor =
									event.exitCode === 0 ? chalk.green : chalk.red;
								console.log(
									exitColor(`\nProcess exited with code ${event.exitCode}`),
								);
							}

							if (event.error) {
								console.error(chalk.red(`\nError: ${event.error}`));
							}
						} catch {
							// Ignore malformed JSON
						}
					}
				}
			}

			// Output collected logs in JSON mode
			if (json) {
				formatOutput(collectedLogs, true);
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		} finally {
			process.off("SIGINT", cleanup);
			process.off("SIGTERM", cleanup);
		}
	});
