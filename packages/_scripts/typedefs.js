import glob from 'glob-promise'
import ts from 'typescript'

// we'll generate the types for every file in the package in one go
export default async function generateTypedefs() {
	const files = await glob('./src/**/*.ts', { nodir: true })

	compile(files, {
		outdir: './build',
		strict: true,
		esModuleInterop: true,
		lib: ['esnext', 'dom', 'ES2021.String'],
		skipLibCheck: true,
		downlevelIteration: true,
		target: 'es2020',
		sourceMap: true,
		declaration: false,
		module: 'es2020',
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
