import path from 'path'
import fs from 'fs/promises'
import ts from 'typescript'

export async function recursiveCopy(source: string, target: string, notRoot?: boolean) {
	// if the folder containing the target doesn't exist, then we need to create it
	let parentDir = path.join(target, path.basename(source))
	// if we are at the root, then go up one
	if (!notRoot) {
		parentDir = path.join(parentDir, '..')
	}
	try {
		await fs.access(parentDir)
		// the parent directory does not exist
	} catch (e) {
		await fs.mkdir(parentDir)
	}

	// check if we are copying a directory
	if ((await fs.stat(source)).isDirectory()) {
		// look in the contents of the source directory
		await Promise.all(
			(await fs.readdir(source)).map(async (child) => {
				// figure out the full path of the source
				const childPath = path.join(source, child)

				// if the child is a directory
				if ((await fs.lstat(childPath)).isDirectory()) {
					// keep walking down
					await recursiveCopy(childPath, parentDir, true)
				}
				// the child is a file, copy it to the parent directory
				else {
					const targetPath = path.join(parentDir, child)

					await fs.writeFile(targetPath, await fs.readFile(childPath, 'utf-8'))
				}
			})
		)
	}
}

export function compile(fileNames: string[]) {
	const options: ts.CompilerOptions = {
		...ts.getDefaultCompilerOptions(),
		allowJs: true,
		declaration: true,
		lib: ['es2015', 'dom'],
		strict: true,
		esModuleInterop: true,
		declarationMap: true,
		skipLibCheck: true,
		downlevelIteration: true,
		target: ts.ScriptTarget.ES5,
		moduleResolution: ts.ModuleResolutionKind.NodeJs,
	}

	// prepare and emit the files
	const program = ts.createProgram(fileNames, options)
	const emitResult = program.emit()

	// catch any diagnostic errors
	for (const diagnostic of ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)) {
		if (diagnostic.file) {
			let { line, character } = ts.getLineAndCharacterOfPosition(
				diagnostic.file,
				diagnostic.start!
			)
			let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
			throw new Error(
				`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
			)
		} else {
			// throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
		}
	}

	return
}
