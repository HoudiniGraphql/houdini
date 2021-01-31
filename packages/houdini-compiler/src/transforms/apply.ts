import { CollectedGraphQLDocument, Transform } from '../types'

// the transforms to apply form a graph
export type TransformPipelineNode = {
	transforms: Transform[]
	then?: TransformPipelineNode[]
}

export default async function applyTransforms(
	documents: CollectedGraphQLDocument[],
	pipeline: TransformPipelineNode
) {
	// we're going to append transforms that need to be applied
	// start with the initial set of transforms
	const nodesToApply = [pipeline]

	// apply every transform we have encountered
	while (nodesToApply.length > 0) {
		// grab the first transform
		const node = nodesToApply.shift()
		// if we got an empty value
		if (!node) {
			// move along
			continue
		}

		// apply every transform in the node
		await Promise.all(node.transforms.map((transform) => transform(documents)))

		// add the node's depedents to the list
		if (node.then) {
			nodesToApply.push(...node.then)
		}
	}
}
