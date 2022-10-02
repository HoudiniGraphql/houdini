import fs from 'fs'
import glob from 'glob-promise'
import path from 'path'
import ts from 'typescript'

const { ModuleResolutionKind } = ts
const tsConfig = JSON.parse(fs.readFileSync('../../tsconfig.json'))

// we'll generate the types for every file in the package in one go
export default async function generateTypedefs() {
	const files = (await glob('./src/**/*.ts', { nodir: true })).filter(
		(path) => !path.endsWith('.test.ts')
	)

	compile(files, {
		...tsConfig.compilerOptions,
		moduleResolution: ModuleResolutionKind.Node,
		outDir: 'build',
		project: path.join(process.cwd(), '..', '..'),
		lib: ['lib.es2021.d.ts', 'lib.dom.d.ts', 'lib.es2021.string.d.ts'],
	})
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
				diagnostic.start
			)
			let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
			console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
		} else {
			console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
		}
	})

	let exitCode = emitResult.emitSkipped ? 1 : 0
	console.log(`Process exiting with code '${exitCode}'.`)
	process.exit(exitCode)
}
