import esbuild from 'esbuild'
import alias from 'esbuild-plugin-alias'
import path from 'path'
import fs from 'fs/promises'

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
			outConfig = { outfile: `./build/preprocess-${target}.js` }
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
			plugins: [
				alias({
					'~/common': path.resolve('./src/common/index.ts'),
					'~/runtime': path.resolve('./src/runtime/index.ts'),
					'~/preprocess': path.resolve('./src/preprocess/index.ts'),
				}),
			],
		})
	}
}

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
