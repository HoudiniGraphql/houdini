// any error that the compiler could fire
export class HoudiniError extends Error {
	filepath: string | null
	description: string | null = null

	constructor(filepath: string | null, message: string, description?: string | null) {
		super(message)

		this.filepath = filepath
		if (description) {
			this.description = description
		}
	}
}
