// externals
import { Config } from 'houdini-common'
import { OperationDefinitionNode } from 'graphql'
// locals
import { CollectedGraphQLDocument, HoudiniInfoError } from '../types'

type IRecurseDuplicates = {
	path: string
	count: number
}
export function recurseDuplicates(
	node: OperationDefinitionNode,
	currentPath: string[] = [],
	acc: IRecurseDuplicates[] = []
): IRecurseDuplicates[] {
	const selections = node.selectionSet?.selections || []
	if (selections.length === 0) {
		// if no selections under node, return acc
		return acc
	}

	// check if current node has duplicates
	const selectionCount: Record<string, number> = {}
	const childrenDuplicates = selections
		.map((s: any) => {
			// "alias" and "name" are supposed to be valid properties
			const fieldName: string = s.alias?.value || s.name?.value
			if (!fieldName) {
				return []
			}
			selectionCount[fieldName] = (selectionCount[fieldName] || 0) + 1
			return recurseDuplicates(s as any, [...currentPath, fieldName])
		})
		.flat()

	// if current node has duplicates, update acc
	for (let key in selectionCount) {
		if (selectionCount[key] > 1) {
			acc.push({
				path: [...currentPath, key].join('.'),
				count: selectionCount[key],
			})
		}
	}

	return [...acc, ...childrenDuplicates]
}

// verifies that there are no duplicate field selections in a node
export default async function uniqueSelections(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	const operationsWithDuplicates = docs
		.map((doc) => {
			return (doc.originalDocument.definitions as OperationDefinitionNode[])
				.map((def) => {
					return {
						operationName: def.name?.value,
						duplicates: recurseDuplicates(def),
					}
				})
				.flat()
		})
		.flat()
		.filter((d) => d.duplicates.length > 0)

	const errors: HoudiniInfoError[] = operationsWithDuplicates.map(
		({ operationName, duplicates }) => ({
			message: `Duplicate selections encountered in ${operationName}`,
			description: duplicates.map((d) => `${d.path} has ${d.count} duplicates`),
		})
	)

	// if we got errors
	if (errors.length > 0) {
		throw errors
	}

	// we're done here
	return
}
