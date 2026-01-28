import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { auth } from "../lib/auth.js";
import { config } from "../lib/config.js";
import { AuthError, handleError, McpError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";
import type { TaskDoneEvent, TaskStep, TaskStepEvent } from "../types/index.js";

export const taskCommand = new Command("task")
	.description("Send a task to Claude running in the sandbox")
	.argument("<prompt>", "Task description/prompt")
	.option("--mcp-id <id>", "Specific MCP ID")
	.option("--model <model>", "Claude model to use")
	.option("--max-steps <n>", "Maximum tool use steps")
	.action(async (prompt: string, options, command) => {
		const globalOptions = command.optsWithGlobals();
		const json = globalOptions.json ?? false;

		try {
			let mcpId = options.mcpId;

			if (!mcpId) {
				mcpId = await config.getMcpId();
				if (!mcpId) {
					throw new McpError(
						"No active MCP. Run 'waniwani init' then 'waniwani mcp use <name>'.",
					);
				}
			}

			const token = await auth.getAccessToken();
			if (!token) {
				throw new AuthError(
					"Not logged in. Run 'waniwani login' to authenticate.",
				);
			}

			const defaults = await config.getDefaults();
			const model = options.model ?? defaults.model;
			const maxSteps = options.maxSteps
				? Number.parseInt(options.maxSteps, 10)
				: defaults.maxSteps;

			if (!json) {
				console.log();
				console.log(chalk.bold("Task:"), prompt);
				console.log();
			}

			const spinner = ora("Starting task...").start();

			// Use fetch with SSE for streaming
			const baseUrl = await api.getBaseUrl();
			const response = await fetch(`${baseUrl}/api/admin/mcps/${mcpId}/task`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
					Accept: "text/event-stream",
				},
				body: JSON.stringify({
					prompt,
					model,
					maxSteps,
				}),
			});

			if (!response.ok) {
				const error = await response
					.json()
					.catch(() => ({ message: response.statusText }));
				spinner.fail("Task failed");
				throw new Error(
					error.message || `Request failed with status ${response.status}`,
				);
			}

			spinner.stop();

			const steps: TaskStep[] = [];
			let stepCount = 0;
			let maxStepsReached = false;

			// Process SSE stream
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body");
			}

			const decoder = new TextDecoder();
			let buffer = "";

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
							const parsed = JSON.parse(data);

							// Handle step events
							if (parsed.type === "text") {
								const event = parsed as TaskStepEvent;
								steps.push({ type: "text", text: event.content });
								if (!json && event.content) {
									console.log(chalk.white(event.content));
								}
							} else if (parsed.type === "tool_call") {
								const event = parsed as TaskStepEvent;
								steps.push({
									type: "tool_call",
									tool: event.tool,
									input: event.input,
									output: event.output,
								});

								if (!json) {
									console.log(chalk.cyan(`> Using tool: ${event.tool}`));
									if (event.input?.command) {
										console.log(chalk.gray(`  $ ${event.input.command}`));
									}
									if (event.output) {
										// Show abbreviated output
										const outputLines = event.output.split("\n");
										if (outputLines.length > 10) {
											console.log(
												chalk.gray(outputLines.slice(0, 5).join("\n")),
											);
											console.log(
												chalk.gray(
													`  ... (${outputLines.length - 10} more lines)`,
												),
											);
											console.log(chalk.gray(outputLines.slice(-5).join("\n")));
										} else {
											console.log(chalk.gray(event.output));
										}
									}
									console.log();
								}
							} else if (parsed.success !== undefined) {
								// Handle done event
								const doneEvent = parsed as TaskDoneEvent;
								stepCount = doneEvent.stepCount;
								maxStepsReached = doneEvent.maxStepsReached || false;
							}
						} catch {
							// Ignore malformed JSON
						}
					}
				}
			}

			const result = {
				success: true,
				steps,
				stepCount,
				maxStepsReached,
			};

			if (json) {
				formatOutput(result, true);
			} else {
				console.log();
				console.log(chalk.green("✓"), `Task completed in ${stepCount} steps.`);
				if (maxStepsReached) {
					console.log(
						chalk.yellow("⚠"),
						"Maximum steps reached. Task may be incomplete.",
					);
				}
			}
		} catch (error) {
			handleError(error, json);
			process.exit(1);
		}
	});
