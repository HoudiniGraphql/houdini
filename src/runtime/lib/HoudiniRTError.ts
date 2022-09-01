export type RTErrorType = 'default' | 'OutdatedFunction'

// Houdini Runtime Error (something light-weighted)
export class HoudiniRTError extends Error {
	constructor({
		message,
		type = 'default',
		extraInfo = [],
		quiet = false,
	}: {
		message: string
		type?: RTErrorType
		extraInfo?: string[]
		quiet?: boolean
	}) {
		// log extra info before throwing error
		extraInfo?.forEach((line) => {
			console.log(line)
		})

		super(type === 'OutdatedFunction' ? `Outdated function "${message}"` : message)

		// if quiet, don't log the stack trace
		if (quiet) {
			this.stack = ''
		}
	}
}
