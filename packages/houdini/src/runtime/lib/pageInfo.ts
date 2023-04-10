import { siteURL } from './constants'
import type { GraphQLObject, PageInfo } from './types'

export function nullPageInfo(): PageInfo {
	return { startCursor: null, endCursor: null, hasNextPage: false, hasPreviousPage: false }
}

export function missingPageSizeError(fnName: string) {
	return {
		message: `${fnName} is missing the required page arguments. For more information, please visit this link: ${siteURL}/guides/pagination`,
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
