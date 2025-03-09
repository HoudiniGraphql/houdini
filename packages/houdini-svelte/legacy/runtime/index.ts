import type { GraphQLVariables } from '$houdini/runtime/lib/types'
import type { QueryStore } from './stores'

export * from './adapter'
export * from './stores'
export * from './fragments'
export * from './session'
export * from './types'

type LoadResult = Promise<{ [key: string]: QueryStore<any, GraphQLVariables> }>
type LoadAllInput = LoadResult | Record<string, LoadResult>

// gets all the values from an object
type ValueOf<T extends Record<PropertyKey, unknown>> = T[keyof T]

// transforms `A | B | C | ...` to `A & B & C & ...`
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
	? I
	: never;

// transforms `LoadResult` into its awaited type
// transforms `{a: LoadResult}` and replaces the key of the load result with `a`
type InferLoadResult<T extends LoadAllInput> = T extends Record<infer Key, infer Res extends LoadResult> ? {
	[K in Key]: ValueOf<Awaited<Res>>
} : T extends LoadResult ? Awaited<T> : never

export async function loadAll<
	// generic to narrow the array correctly
	L extends LoadAllInput,
	// generic to get all of the inputs otherwise it fails on the `...`
	Loads extends L[]>(
		...loads: Loads
	): Promise<UnionToIntersection<{
		[K in keyof Loads]: InferLoadResult<Loads[K]>
	}[number]>>
// putting this here was the only way i could find to reliably avoid import issues
// its really the only thing from lib that users should import so it makes sense to have it here....
export async function loadAll(
	...loads: LoadAllInput[]
): Promise<Record<string, QueryStore<any, {}>>> {
	// we need to collect all of the promises in a single list that we will await in promise.all and then build up
	const promises: LoadResult[] = []

	// the question we have to answer is whether entry is a promise or an object of promises
	const isPromise = (val: LoadAllInput): val is LoadResult =>
		'then' in val && 'finally' in val && 'catch' in val

	for (const entry of loads) {
		if (!isPromise(entry) && 'then' in entry) {
			throw new Error('❌ `then` is not a valid key for an object passed to loadAll')
		}

		// identify an entry with the `.then` method
		if (isPromise(entry)) {
			promises.push(entry)
		} else {
			for (const [key, value] of Object.entries(entry)) {
				if (isPromise(value)) {
					promises.push(value)
				} else {
					throw new Error(
						`❌ ${key} is not a valid value for an object passed to loadAll. You must pass the result of a load_Store function`
					)
				}
			}
		}
	}

	// now that we've collected all of the promises, wait for them
	await Promise.all(promises)

	// all of the promises are resolved so go back over the value we were given a reconstruct it
	let result = {}

	for (const entry of loads) {
		// if we're looking at a promise, it will contain the key
		if (isPromise(entry)) {
			Object.assign(result, await entry)
		} else {
			Object.assign(
				result,
				// await every value in the object and assign it to result
				Object.fromEntries(
					await Promise.all(
						Object.entries(entry).map(async ([key, value]) => [
							key,
							Object.values(await value)[0],
						])
					)
				)
			)
		}
	}

	// we're done
	return result
}
