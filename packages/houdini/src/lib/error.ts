import fs from 'node:fs'
import { styleText } from "node:util"

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
	let message = `-- ${styleText("red", error.kind + " error")} -----------------------------\n`
	message += error.message + '\n'
	message += '\n'

	if (error.locations) {
		// TODO: we probably don't need to read the *entire* file into memory at once.
		error.locations.forEach((location) => {
			const filepath = path.join(rootDir, location.filepath)
			const contents = readFileSync(filepath)
			if (!contents) {
				throw Error(`failed to read file, '${filepath}'`)
			}

			const lines = contents.split('\n')

			message += `${location.filepath}:${location.line}:${location.column}\n`

			const extraLines = 3
			// Make sure we don't go out of bounds
			const startLine = Math.max(location.line - extraLines, 0)

			const code = lines.slice(startLine - 1, location.line);
			message += format_codeblock(code, startLine);

			// Calculate where to put the error indicators
			const gutterOffset = ` ${location.line} | `.length;
			message += " ".repeat(gutterOffset)
			// column is 1-based, so take that into account
			message += " ".repeat(location.column - 1)
			// Print the indicator in red
			message += styleText("red", "^^^^^")

			message += '\n'
		})
	}

	console.log(message)
}

export function format_codeblock(code: string[], lineNrStart: number): string {
	let output = "";

	const maxLineNrWidth = (lineNrStart + code.length).toString().length

	// Print each row of the code block
	for (let i = 0; i < code.length; i++) {
		// Replace tabs with 4 spaces to make sure we have the correct column?
		const normalized = code[i].replaceAll("\t", "    ")

		const lineNr = (lineNrStart + i).toString()
		const spacing = " ".repeat(maxLineNrWidth - lineNr.length)
		output += ` ${spacing}${lineNr} | ${normalized}\n`
	}

	return output;
}
