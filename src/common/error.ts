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
