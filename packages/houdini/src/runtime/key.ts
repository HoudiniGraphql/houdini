export const computeKey = ({ field, args }: { field: string; args?: { [key: string]: any } }) => {
	const keys = Object.keys(args ?? {})
	keys.sort()

	return args && keys.length > 0
		? `${field}(${keys.map((key) => `${key}: ${stringify(args[key])}`).join(', ')})`
		: field
}

const stringify = (obj_from_json: Record<string, {}>): string => {
	// In case of an array we'll stringify all objects.
	if (Array.isArray(obj_from_json)) {
		return `[${obj_from_json.map((obj) => `${stringify(obj)}`).join(', ')}]`
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
		.map((key) => `${key}: ${stringify(obj_from_json[key])}`)
		.join(', ')}}`
}
