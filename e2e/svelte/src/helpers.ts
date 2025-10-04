/**
 * Sleep function - promise-based wrapper over setTimeout
 */
export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
