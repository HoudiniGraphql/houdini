import fs from 'node:fs'

import { readFileSync } from './fs'
import * as path from './path'

// any error that the compiler could fire
export class HoudiniError extends Error {
	filepath: string | null = null
	description: string | null = null

	constructor({
		filepath,
		message,
		description,
	}: {
		filepath?: string | null
		message: string
		description?: string | null
	}) {
		super(message)

		if (filepath) {
			this.filepath = filepath
		}
		if (description) {
			this.description = description
		}
	}
}

export function format_error(e: unknown, after?: (e: Error) => void) {
	// we need an array of errors to loop through
	const errors = (Array.isArray(e) ? e : [e]) as (Error & {
		filepath?: string
		description?: string
	})[]

	for (const error of errors) {
		// if we have filepath, show that to the user
		if ('filepath' in error && error.filepath) {
			const relative = path.relative(process.cwd(), error.filepath)
			console.error(`❌ Encountered error in ${relative}`)
			if (error.message) {
				console.error(error.message)
			}
		} else {
			console.error(`❌ ${error.message}`)
			if ('description' in error && error.description) {
				console.error(`${error.description}`)
			}
		}
		after?.(e as Error)
	}
}

export type HookError = {
	message: string
	detail: string
	locations: HookErrorLocation[]
	kind: string
}
type HookErrorLocation = {
	filepath: string
	line: number
	column: number
}

export function format_hook_error(rootDir: string, error: HookError) {
	let message = `-- ${error.kind} error -----------------------------\n`
	message += error.message + '\n'
	message += '\n'

	error.locations.forEach((location) => {
		// TODO: we probably don't need to read the *entire* file into memory at once.
		const filepath = path.join(rootDir, location.filepath)
		const contents = readFileSync(filepath)
		if (!contents) {
			throw Error(`failed to read file, '${filepath}'`)
		}

		const lines = contents.split('\n')

		message += `${location.filepath}\n`

		const extraLines = 2
		// Make sure we don't go out of bounds
		const startLine = Math.max(location.line - extraLines, 0)
		for (let i = startLine; i <= location.line; i++) {
			const requiredPadding = Math.max(`${i}`.length - `${startLine}`.length, 0)
			const padding = ' '.repeat(requiredPadding)

			let line = lines[i - 1]
			if (!line) continue
			line = line.replaceAll('\t', '    ')
			message += `${padding}${i} | ${line}\n`
		}

		message += `${' '.repeat(location.line.toString().length)}   ${' '.repeat(
			Math.max(location.column - 1, 0)
		)}^`

		message += '\n'
	})

	console.log(message)
}
