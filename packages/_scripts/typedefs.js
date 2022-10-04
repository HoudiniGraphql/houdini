import fs from 'fs'
import fs_extra from 'fs-extra'
import glob from 'glob-promise'
import path from 'path'
import ts from 'typescript'

const { ModuleResolutionKind } = ts
const tsConfig = JSON.parse(fs.readFileSync('../../tsconfig.json', 'utf-8'))

// we'll generate the types for every file in the package in one go
export default async function generate_typedefs() {
	// grab any non-tests file
	const files = (await glob('./src/**/*.ts', { nodir: true })).filter(
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

	// if we have a runtime directory, we need to copy the typedefs we just generated into the
	// different modules
	const runtime_dir = path.resolve('./build/runtime')
	if (fs.existsSync(runtime_dir)) {
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
}
