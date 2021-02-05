// local imports
import { TransformPipeline } from '../types'

export async function applyTransforms<_TransformType>(
	pipeline: TransformPipeline<_TransformType>,
	target: _TransformType
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
		await Promise.all(node.transforms.map((transform) => transform(target)))

		// add the node's depedents to the list
		if (node.then) {
			nodesToApply.push(...node.then)
		}
	}
}
