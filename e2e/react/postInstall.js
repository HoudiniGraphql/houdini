import fs from 'node:fs/promises'

try {
	await fs.symlink(
		`../../../../packages/houdini/build/cmd-esm/index.js`,
		`node_modules/.bin/houdini`,
		'file'
	)
} catch {}

// make sure its executable
await fs.chmod(`node_modules/.bin/houdini`, 0o755)
