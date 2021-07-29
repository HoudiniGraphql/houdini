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
