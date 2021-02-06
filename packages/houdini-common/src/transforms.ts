// locals
import { Config } from './config'

// transforms are functions that takes the collected documents. some will mutate
// the document definition, some check the definition for errors (undefined fields, etc)
export type Transform<_TransformType> = (config: Config, documents: _TransformType) => Promise<void>

// the transforms to apply form a graph
export type TransformPipeline<_TransformType> = {
	transforms: Transform<_TransformType>[]
	then?: TransformPipeline<_TransformType>[]
}

export async function applyTransforms<_TransformType>(
	config: Config,
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
		await Promise.all(node.transforms.map((transform) => transform(config, target)))

		// add the node's depedents to the list
		if (node.then) {
			nodesToApply.push(...node.then)
		}
	}
}
