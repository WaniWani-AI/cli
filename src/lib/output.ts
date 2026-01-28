import chalk from "chalk";

export function formatOutput<T>(data: T, json: boolean): void {
	if (json) {
		console.log(JSON.stringify({ success: true, data }, null, 2));
	} else {
		prettyPrint(data);
	}
}

export function formatSuccess(message: string, json: boolean): void {
	if (json) {
		console.log(JSON.stringify({ success: true, message }));
	} else {
		console.log(chalk.green("✓"), message);
	}
}

export function formatError(error: Error | string, json: boolean): void {
	const message = error instanceof Error ? error.message : error;
	if (json) {
		console.error(JSON.stringify({ success: false, error: message }));
	} else {
		console.error(chalk.red("✗"), message);
	}
}

export function formatTable(
	headers: string[],
	rows: string[][],
	json: boolean,
): void {
	if (json) {
		const data = rows.map((row) =>
			Object.fromEntries(headers.map((header, i) => [header, row[i]])),
		);
		console.log(JSON.stringify({ success: true, data }, null, 2));
	} else {
		// Simple table formatting without external dependency
		const colWidths = headers.map((h, i) =>
			Math.max(h.length, ...rows.map((r) => (r[i] || "").length)),
		);

		const separator = colWidths.map((w) => "-".repeat(w + 2)).join("+");
		const formatRow = (row: string[]) =>
			row.map((cell, i) => ` ${(cell || "").padEnd(colWidths[i])} `).join("|");

		console.log(chalk.cyan(formatRow(headers)));
		console.log(separator);
		for (const row of rows) {
			console.log(formatRow(row));
		}
	}
}

export function formatList(
	items: Array<{ label: string; value: string }>,
	json: boolean,
): void {
	if (json) {
		const data = Object.fromEntries(
			items.map((item) => [item.label, item.value]),
		);
		console.log(JSON.stringify({ success: true, data }, null, 2));
	} else {
		const maxLabelLength = Math.max(...items.map((i) => i.label.length));
		items.forEach((item) => {
			console.log(
				`${chalk.gray(item.label.padEnd(maxLabelLength))}  ${chalk.white(item.value)}`,
			);
		});
	}
}

function prettyPrint(data: unknown, indent = 0): void {
	const prefix = "  ".repeat(indent);

	if (Array.isArray(data)) {
		data.forEach((item, index) => {
			console.log(`${prefix}${chalk.gray(`[${index}]`)}`);
			prettyPrint(item, indent + 1);
		});
	} else if (typeof data === "object" && data !== null) {
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === "object" && value !== null) {
				console.log(`${prefix}${chalk.gray(key)}:`);
				prettyPrint(value, indent + 1);
			} else {
				console.log(
					`${prefix}${chalk.gray(key)}: ${chalk.white(String(value))}`,
				);
			}
		}
	} else {
		console.log(`${prefix}${chalk.white(String(data))}`);
	}
}
