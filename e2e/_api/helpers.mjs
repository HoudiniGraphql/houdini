/**
 * Sleep function - promise-based wrapper over setTimeout
 */
export async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Green color function - just returns the string without coloring
 */
export function green(text) {
	return text
}
