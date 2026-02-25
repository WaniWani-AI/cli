/**
 * Resolve a promise, or return null if it does not settle within timeoutMs.
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	options?: {
		onTimeout?: () => void;
	},
): Promise<T | null> {
	let timer: NodeJS.Timeout | undefined;

	try {
		return await Promise.race([
			promise,
			new Promise<null>((resolve) => {
				timer = setTimeout(() => {
					options?.onTimeout?.();
					resolve(null);
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timer) {
			clearTimeout(timer);
		}
	}
}
