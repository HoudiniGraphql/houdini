import { HoudiniFetchContext } from '../lib/types'
import { getHoudiniContext } from '../lib/context'

export class BaseStore {
	protected context: HoudiniFetchContext | null = null

	constructor() {
		// try to get the current context in case the store was instantiated somewhere that allows for it
		try {
			this.context = getHoudiniContext(true)
		} catch {}
	}

	setContext(ctx: HoudiniFetchContext) {
		this.context = ctx
	}
}
