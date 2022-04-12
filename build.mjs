import esbuild from 'esbuild'
import alias from 'esbuild-plugin-alias'
import path from 'path'
import fs from 'fs-extra'

// figure out the correct inputs for each target we have to build
const entryPoints = {
	cmd: ['./src/cmd/main.js'],
	runtime: await getAllFiles('./src/runtime'),
	preprocess: ['./src/preprocess/index.ts'],
}

// build each package
for (const which of ['cmd', 'runtime', 'preprocess']) {
	for (const target of ['esm', 'cjs']) {
		let outConfig = { outfile: `./build/${which}.cjs` }
		if (which === 'runtime') {
			outConfig = { outdir: `./build/runtime-${target}` }
		} else if (which === 'preprocess') {
			outConfig = { outfile: `./build/preprocess-${target}/index.js` }
		}

		// compile the cli as common js
		if (which === 'cmd' && target === 'esm') {
			continue
		}

		// build the esmodule versions
		await esbuild.build({
			entryPoints: entryPoints[which],
			...outConfig,
			bundle: which !== 'runtime',
			target: which === 'runtime' ? ['es2020'] : 'node16',
			platform: 'node',
			format: target,
			banner:
				target === 'cjs'
					? undefined
					: {
							js: [
								`import { createRequire as topLevelCreateRequire } from 'module'`,
								`const require = topLevelCreateRequire(import.meta.url)`,
							].join('\n'),
					  },
		})
	}
}

await Promise.all([
	fs.copy('./build/runtime', './build/runtime-cjs'),
	fs.copy('./build/runtime', './build/runtime-esm'),
	// give module types to the various packages
	fs.writeFile(
		'./build/preprocess-esm/package.json',
		JSON.stringify({ type: 'module' }, null, 4),
		'utf-8'
	),
	fs.writeFile(
		'./build/preprocess-cjs/package.json',
		JSON.stringify({ type: 'commonjs' }, null, 4),
		'utf-8'
	),
	fs.writeFile('./build/package.json', JSON.stringify({ type: 'commonjs' }, null, 4), 'utf-8'),
])

async function getAllFiles(dir, files = []) {
	// look at every child of the directory
	for (const child of await fs.readdir(dir)) {
		const childPath = path.resolve(dir, child)

		if ((await fs.stat(childPath)).isDirectory()) {
			await getAllFiles(childPath, files)
		} else if (!childPath.endsWith('.test.ts')) {
			files.push(childPath)
		}
	}

	return files
}
