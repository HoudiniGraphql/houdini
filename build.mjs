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
		let outConfig = { outfile: `./build/${which}.js` }
		if (which === 'runtime') {
			outConfig = { outdir: `./build/runtime-${target}` }
		} else if (which === 'preprocess') {
			outConfig = { outfile: `./build/preprocess-${target}/index.js` }
		}

		// ignore commonjs cmd
		if (which === 'cmd' && target === 'cjs') {
			continue
		}

		// build the esmodule versions
		await esbuild.build({
			entryPoints: entryPoints[which],
			...outConfig,
			bundle: which !== 'runtime',
			target: ['es2020'],
			platform: 'node',
			format: target,
		})
	}
}

await Promise.all([
	fs.copy('./build/runtime', './build/runtime-cjs'),
	fs.copy('./build/runtime', './build/runtime-esm'),
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
