/**
 * Debounce a function to limit how often it can be called
 */
// biome-ignore lint/suspicious/noExplicitAny: Necessary for generic debounce
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
}

/**
 * Binary file extensions that should be base64 encoded
 */
const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".ico",
	".webp",
	".svg",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".otf",
	".zip",
	".tar",
	".gz",
	".pdf",
	".exe",
	".dll",
	".so",
	".dylib",
	".bin",
	".mp3",
	".mp4",
	".wav",
	".ogg",
	".webm",
]);

/**
 * Check if a file path is likely a binary file based on extension
 */
export function isBinaryPath(filePath: string): boolean {
	const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
	return BINARY_EXTENSIONS.has(ext);
}

/**
 * Detect if a buffer contains binary data by checking for null bytes
 */
export function detectBinary(buffer: Buffer): boolean {
	// Check first 8KB for null bytes
	const sample = buffer.subarray(0, 8192);
	return sample.includes(0);
}
