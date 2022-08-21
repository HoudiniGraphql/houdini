import { GraphQLObject } from '../../lib'
import * as log from '../../lib/log'

export function nullPageInfo(): PageInfo {
	return { startCursor: null, endCursor: null, hasNextPage: false, hasPreviousPage: false }
}

export const contextError = `${log.red(
	'⚠️ Could not find houdini context for a pagination method ⚠️'
)}
This really shouldn't happen. Please open a ticket describing your situation.

In the meantime, you will need to do something like the following. Make sure getHoudiniContext is
called at the top of your component (outside any event handlers or function definitions) and then
passed to the method:

<script lang="ts">
    const ${log.yellow('context')} = getHoudiniContext();

    const onClick = () => GQL_${log.cyan('[YOUR_STORE]')}.loadNextPage(null, null, ${log.yellow(
	'context'
)});
</script>`

export type PageInfo = {
	startCursor: string | null
	endCursor: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
}

export function missingPageSizeError(fnName: string) {
	return {
		message: `${fnName} is missing the required page arguments. For more information, please visit this link: https://www.houdinigraphql.com/guides/pagination`,
	}
}

export function extractPageInfo(data: any, path: string[]): PageInfo {
	if (!data) {
		return {
			startCursor: null,
			endCursor: null,
			hasNextPage: false,
			hasPreviousPage: false,
		}
	}

	let localPath = [...path]
	// walk down the object until we get to the end
	let current = data
	while (localPath.length > 0) {
		if (!current) {
			break
		}
		current = current[localPath.shift() as string] as GraphQLObject
	}

	return (current?.pageInfo as PageInfo) ?? nullPageInfo()
}

export function countPage<_Data extends GraphQLObject>(
	source: string[],
	value: _Data | null
): number {
	let data = value
	if (value === null || data === null || data === undefined) {
		return 0
	}

	for (const field of source) {
		const obj = data[field] as _Data | _Data[]
		if (obj && !Array.isArray(obj)) {
			data = obj
		} else if (!data) {
			throw new Error('Could not count page size')
		}

		if (Array.isArray(obj)) {
			return obj.length
		}
	}

	return 0
}
