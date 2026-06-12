/**
 * Walk `next` and, wherever a sub-tree is deeply equal to the corresponding
 * sub-tree in `prev`, substitute `prev`'s reference.  This preserves object
 * identity for unchanged branches so React.memo can bail out on re-renders
 * when a cache write touches unrelated parts of the graph.
 *
 * Arrays are reconciled by index.  When lengths differ the array itself gets a
 * new reference, but individual matching elements are still recycled so that
 * items from the previous render keep their identities.
 */
export function recycleNodesInto<T>(prev: T | null | undefined, next: T): T {
	if (Object.is(prev, next)) return prev as T

	if (next === null || typeof next !== 'object') return next
	if (prev === null || prev === undefined || typeof prev !== 'object') return next

	if (Array.isArray(next)) {
		if (!Array.isArray(prev)) return next

		const nextLen = next.length
		const prevLen = (prev as unknown[]).length
		const minLen = Math.min(prevLen, nextLen)

		let changed = false
		const result: unknown[] = new Array(nextLen)

		for (let i = 0; i < minLen; i++) {
			result[i] = recycleNodesInto((prev as unknown[])[i], next[i])
			if (result[i] !== (prev as unknown[])[i]) changed = true
		}
		for (let i = minLen; i < nextLen; i++) {
			result[i] = next[i]
		}

		if (!changed && prevLen === nextLen) return prev as T
		return result as unknown as T
	}

	const prevObj = prev as Record<string, unknown>
	const nextObj = next as Record<string, unknown>
	const nextKeys = Object.keys(nextObj)
	const prevKeyCount = Object.keys(prevObj).length

	let changed = prevKeyCount !== nextKeys.length
	const result: Record<string, unknown> = {}

	for (const key of nextKeys) {
		result[key] = recycleNodesInto(prevObj[key], nextObj[key])
		if (result[key] !== prevObj[key]) changed = true
	}

	return changed ? (result as T) : (prev as T)
}
