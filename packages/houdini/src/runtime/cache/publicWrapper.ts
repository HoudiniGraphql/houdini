import { Cache } from './cache'
import { SchemaManager } from './schema'

export class CacheProxy {
	cache: Cache

	constructor(cache: Cache) {
		this.cache = cache
	}

	// if the user is using the imperative API, we want the ability to break the API
	// with any minor version. In order to do this, we require them to accept this contract
	// through their config file
	validateInstabilityWarning() {
		if (!this.cache._internal_unstable.config.acceptImperativeInstability) {
			console.warn(`⚠️  The imperative cache API is considered unstable and will change in any minor version release
Please acknowledge this by setting acceptImperativeInstability to true in your config file.`)
		}
	}

	// if the user tries to assign a field type that we haven't seen before
	// then we need to provide a way for them to give us that information
	setFieldType(...args: Parameters<SchemaManager['setFieldType']>) {
		this.validateInstabilityWarning()
		this.cache._internal_unstable.schema.setFieldType(...args)
	}
}

export class RecordProxy {
	id: string

	constructor(id: string) {
		this.id = id
	}
}
