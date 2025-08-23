import fsSync from 'fs'
import fs_extra from 'fs-extra'
import fs from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import ts from 'typescript'

const { ModuleResolutionKind } = ts
const tsConfig = JSON.parse(fsSync.readFileSync('../../tsconfig.json', 'utf-8'))

// we'll generate the types for every file in the package in one go
export default async function generate_typedefs({ plugin }) {
	const package_json = JSON.parse(
		await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
	)

	// grab any non-tests file
	const files = (await glob('./src/**/*.ts*', { nodir: true })).filter(
		(path) => !path.endsWith('.test.ts')
	)

	// compile the types
	compile(files, {
		...tsConfig.compilerOptions,
		moduleResolution: ModuleResolutionKind.NodeJs,
		outDir: 'build',
		project: path.join(process.cwd(), '..', '..'),
		baseUrl: process.cwd(),
		lib: ['lib.es2021.d.ts', 'lib.dom.d.ts', 'lib.es2021.string.d.ts'],
	})

	// if we generated typedefs for a plugin, it referenced houdini and needs to be pulled out
	let nested_typedefs = false
	let plugin_dir = path.resolve('.', 'build', package_json.name, 'src')
	try {
		await fs.stat(plugin_dir)
		nested_typedefs = true
	} catch {}
	if (plugin && nested_typedefs) {
		// every directory in 'build/<package name>/src' needs to be moved into build
		for (const child of await fs.readdir(plugin_dir)) {
			await fs_extra.move(
				path.join(plugin_dir, child),
				path.join(plugin_dir, '..', '..', child),
				{
					overwrite: true,
				}
			)
		}
		fsSync.rmSync(path.resolve('.', 'build', 'houdini'), { recursive: true, force: true })
		fsSync.rmSync(path.resolve('.', 'build', package_json.name), {
			recursive: true,
			force: true,
		})
	}

	// if we have a runtime directory, we need to copy the typedefs we just generated into the
	// different modules
	const runtime_dir = path.resolve('./build/runtime')
	if (fsSync.existsSync(runtime_dir)) {
		await Promise.all(
			['esm', 'cjs'].map((which) =>
				fs_extra.copy(runtime_dir, path.resolve('build', `runtime-${which}`), {
					overwrite: true,
				})
			)
		)
	}
}

/** @type { function(string[], import('typescript').CompilerOptions): void } */
function compile(fileNames, options) {
	let program = ts.createProgram(fileNames, options)
	let emitResult = program.emit()

	let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

	allDiagnostics.forEach((diagnostic) => {
		if (diagnostic.file) {
			let { line, character } = ts.getLineAndCharacterOfPosition(
				diagnostic.file,
				diagnostic.start ?? 0
			)
			let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
			console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
		} else {
			console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
		}
	})

	if (allDiagnostics.length > 0) {
		process.exit(1)
	}
}
