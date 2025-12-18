import fsSync from 'fs'
import fs_extra from 'fs-extra'
import fs from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import ts from 'typescript'

const { ModuleResolutionKind } = ts
const tsConfig = JSON.parse(fsSync.readFileSync('../../tsconfig.json', 'utf-8'))

// we'll generate the types for every file in the package in one go
export default async function generate_typedefs({ plugin, goPackage }) {
	const package_json = JSON.parse(
		await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
	)

	// grab any non-tests file from all TypeScript directories
	// Note: 'runtime' is excluded because it should be copied as raw .ts files
	const typescriptDirs = ['src', 'legacy', 'package', 'plugin']
	let files = []

	for (const dir of typescriptDirs) {
		try {
			const dirFiles = await glob(`./${dir}/**/*.ts*`, { nodir: true })
			files.push(...dirFiles)
		} catch (e) {
			// Directory doesn't exist, skip it
		}
	}

	// Filter out test files
	files = files.filter((path) => !path.endsWith('test.ts'))

	// compile the types
	compile(files, {
		...tsConfig.compilerOptions,
		moduleResolution: ModuleResolutionKind.NodeJs,
		outDir: 'build',
		project: path.join(process.cwd(), '..', '..'),
		baseUrl: process.cwd(),
		lib: ['lib.es2021.d.ts', 'lib.dom.d.ts', 'lib.es2021.string.d.ts'],
	})

	// Also verify runtime directory types (no emit)
	try {
		const runtimeFiles = await glob('./runtime/**/*.ts*', { nodir: true })
		const filteredRuntimeFiles = runtimeFiles.filter((path) => !path.endsWith('test.ts'))

		if (filteredRuntimeFiles.length > 0) {
			verifyTypes(filteredRuntimeFiles, {
				...tsConfig.compilerOptions,
				moduleResolution: ModuleResolutionKind.NodeJs,
				noEmit: true, // Only verify, don't emit
				emitDeclarationOnly: false, // Disable declaration-only mode when using noEmit
				project: path.join(process.cwd(), '..', '..'),
				baseUrl: process.cwd(),
				lib: ['lib.es2021.d.ts', 'lib.dom.d.ts', 'lib.es2021.string.d.ts'],
			})
		}
	} catch (e) {
		// Runtime directory doesn't exist, skip it
	}

	// if we generated typedefs for a plugin, it referenced houdini and needs to be pulled out
	let nested_typedefs = false
	let plugin_dir = path.resolve('.', 'build', package_json.name, 'src')
	try {
		await fs.stat(plugin_dir)
		nested_typedefs = true
	} catch {}
	if (plugin && nested_typedefs) {
		if (goPackage) {
			// For Go packages, we want to keep directories inside build/<package_name>
			// Move directories from 'build/<package name>/src' to 'build/<package name>'
			for (const child of await fs.readdir(plugin_dir)) {
				await fs_extra.move(
					path.join(plugin_dir, child),
					path.join(plugin_dir, '..', child),
					{
						overwrite: true,
					}
				)
			}

		} else {
			// For Node packages, move directories from 'build/<package name>/src' to 'build' (original behavior)
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
	}

	// For Node packages (non-plugin or plugin without goPackage), flatten any dependency directories
	if (!goPackage) {
		const buildDir = path.resolve('.', 'build')
		const dependencyDirs = ['houdini', 'houdini-core']

		for (const depDir of dependencyDirs) {
			const depPath = path.join(buildDir, depDir)
			try {
				const stats = await fs.stat(depPath)
				if (stats.isDirectory()) {
					// Move contents of dependency directory to build root
					const children = await fs.readdir(depPath)
					for (const child of children) {
						const srcPath = path.join(depPath, child)
						const destPath = path.join(buildDir, child)

						// If destination exists, merge directories or overwrite files
						try {
							const destStats = await fs.stat(destPath)
							if (destStats.isDirectory()) {
								// Merge directories
								await fs_extra.copy(srcPath, destPath, { overwrite: true })
							} else {
								// Overwrite file
								await fs_extra.move(srcPath, destPath, { overwrite: true })
							}
						} catch {
							// Destination doesn't exist, just move
							await fs_extra.move(srcPath, destPath, { overwrite: true })
						}
					}
					// Remove the now-empty dependency directory
					fsSync.rmSync(depPath, { recursive: true, force: true })
				}
			} catch {
				// Directory doesn't exist, skip
			}
		}

		// For Node packages, also flatten the main package's src directory
		const srcDir = path.join(buildDir, 'src')
		try {
			const srcStats = await fs.stat(srcDir)
			if (srcStats.isDirectory()) {
				// Move contents of src directory to build root
				const srcChildren = await fs.readdir(srcDir)
				for (const child of srcChildren) {
					const srcPath = path.join(srcDir, child)
					const destPath = path.join(buildDir, child)

					// If destination exists, merge directories or overwrite files
					try {
						const destStats = await fs.stat(destPath)
						if (destStats.isDirectory()) {
							// Merge directories
							await fs_extra.copy(srcPath, destPath, { overwrite: true })
						} else {
							// Overwrite file
							await fs_extra.move(srcPath, destPath, { overwrite: true })
						}
					} catch {
						// Destination doesn't exist, just move
						await fs_extra.move(srcPath, destPath, { overwrite: true })
					}
				}
				// Remove the now-empty src directory
				fsSync.rmSync(srcDir, { recursive: true, force: true })
			}
		} catch {
			// src directory doesn't exist, skip
		}
	}

	// For Go packages, move the 'package' directory contents to the package root and remove dependency directories
	if (goPackage) {
		const packageDir = path.resolve('.', 'build', package_json.name, 'package')
		const packageRoot = path.resolve('.', 'build', package_json.name)

		try {
			const packageStats = await fs.stat(packageDir)
			if (packageStats.isDirectory()) {
				// Move contents of package directory to package root (merge with existing files)
				const packageChildren = await fs.readdir(packageDir)
				for (const child of packageChildren) {
					const srcPath = path.join(packageDir, child)
					const destPath = path.join(packageRoot, child)

					// Check if destination exists and handle accordingly
					try {
						const destStats = await fs.stat(destPath)
						if (destStats.isDirectory()) {
							// Merge directories (copy TypeScript definitions into existing directory)
							await fs_extra.copy(srcPath, destPath, { overwrite: false })
						} else {
							// Destination is a file, don't overwrite (keep the JS file)
							const srcStats = await fs.stat(srcPath)
							if (srcStats.isDirectory()) {
								// Source is directory, destination is file - this shouldn't happen
								await fs_extra.copy(srcPath, destPath, { overwrite: false })
							}
							// If both are files, don't overwrite (keep the JS file)
						}
					} catch {
						// Destination doesn't exist, just move
						await fs_extra.move(srcPath, destPath)
					}
				}

				// Remove the now-empty package directory
				fsSync.rmSync(packageDir, { recursive: true, force: true })
			}
		} catch {
			// Package directory doesn't exist, skip
		}

		// Remove dependency directories for Go packages (they shouldn't be in the final output)
		// But don't remove the main package directory
		const dependencyDirs = ['houdini', 'houdini-core']
		for (const depDir of dependencyDirs) {
			if (depDir !== package_json.name) {
				fsSync.rmSync(path.resolve('.', 'build', depDir), { recursive: true, force: true })
			}
		}
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

/** @type { function(string[], import('typescript').CompilerOptions): void } */
function verifyTypes(fileNames, options) {
	let program = ts.createProgram(fileNames, options)

	// Only get pre-emit diagnostics for type checking (no emit)
	let allDiagnostics = ts.getPreEmitDiagnostics(program)

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
