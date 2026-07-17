import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.js', 'src/sv-utils.js'],
	format: 'esm'
});
