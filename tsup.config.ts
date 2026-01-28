import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node20",
	dts: true,
	clean: true,
	shims: true,
	splitting: false,
	sourcemap: true,
	minify: false,
	banner: {
		js: "#!/usr/bin/env node",
	},
});
