import { path } from '.'

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

export function formatErrors(e: unknown, afterError?: (e: Error) => void) {
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
		afterError?.(e as Error)
	}
}
