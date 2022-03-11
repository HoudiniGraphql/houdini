// a proxy is an object that we can embed in an artifact so that
// we can mutate the internals of a document handler without worrying about
// the return value of the handler
export class HoudiniDocumentProxy {
	initial: any = null

	callbacks: ((val: any) => void)[] = []

	listen(callback: (val: any) => void) {
		this.callbacks.push(callback)

		if (this.initial) {
			callback(this.initial)
		}
	}

	invoke(val: any) {
		// if there are no callbacks, just save the value and wait for the first one
		if (this.callbacks.length === 0) {
			this.initial = val
			return
		}

		for (const callback of this.callbacks) {
			callback(val)
		}
	}
}
