export const computeKey = ({ field, args }: { field: string; args?: { [key: string]: any } }) => {
	const keys = Object.keys(args ?? {})
	keys.sort()

	return args && keys.length > 0
		? `${field}(${keys
				.map((key) => `${key}: ${stringifyObjectWithNoQuotesOnKeys(args[key])}`)
				.join(', ')})`
		: field
}

const stringifyObjectWithNoQuotesOnKeys = (obj_from_json: {}): string => {
	// In case of an array we'll stringify all objects.
	if (Array.isArray(obj_from_json)) {
		return `[${obj_from_json
			.map((obj) => `${stringifyObjectWithNoQuotesOnKeys(obj)}`)
			.join(', ')}]`
	}
	// not an object, stringify using native function
	if (
		typeof obj_from_json !== 'object' ||
		obj_from_json instanceof Date ||
		obj_from_json === null
	) {
		return JSON.stringify(obj_from_json).replace(/"([^"]+)":/g, '$1: ')
	}
	// Implements recursive object serialization according to JSON spec
	// but without quotes around the keys.
	return `{${Object.keys(obj_from_json)
		// @ts-ignore
		.map((key) => `${key}: ${stringifyObjectWithNoQuotesOnKeys(obj_from_json[key])}`)
		.join(', ')}}`
}
