import { GraphQLObject } from './types'

export type PageInfo = {
	startCursor: string | null
	endCursor: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
}

export function extractPageInfo(data: GraphQLObject, path: string[]): PageInfo {
	let localPath = [...path]
	// walk down the object until we get to the end
	let current = data
	while (localPath.length > 0) {
		current = current[localPath.shift() as string] as GraphQLObject
	}

	return current.pageInfo as PageInfo
}

export function countPage(source: string[], value: GraphQLObject): number {
	let data = value
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
