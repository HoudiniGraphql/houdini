import { GraphQLObject } from './types'

export type PageInfo = {
	startCursor: string | null
	endCursor: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
}

export function extractPageInfo(data: GraphQLObject, path: string[]): PageInfo {
	if (data === null) {
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
		if (current === null) {
			break
		}
		current = current[localPath.shift() as string] as GraphQLObject
	}

	return (
		(current?.pageInfo as PageInfo) ?? {
			startCursor: null,
			endCursor: null,
			hasNextPage: false,
			hasPreviousPage: false,
		}
	)
}

export function countPage(source: string[], value: GraphQLObject): number {
	let data = value
	if (value === null) {
		return 0
	}

	for (const field of source) {
		const obj = data[field] as GraphQLObject | GraphQLObject[]
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
