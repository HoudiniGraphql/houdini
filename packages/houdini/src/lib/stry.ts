/**
 * Safe stringify function that converts objects to JSON strings with formatting
 * Similar to @kitql/helpers stry function
 */
export function stry(value: any, indent?: number): string {
	try {
		if (value === null || value === undefined) {
			return String(value)
		}

		// If indent is provided, use it for pretty printing
		if (typeof indent === 'number') {
			return JSON.stringify(value, null, indent)
		}

		// Default to compact JSON
		return JSON.stringify(value)
	} catch (error) {
		// Fallback for circular references or other stringify errors
		return String(value)
	}
}
