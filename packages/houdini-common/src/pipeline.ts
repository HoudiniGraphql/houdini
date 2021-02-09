// locals
import { Config } from './config'

// transforms are functions that takes the collected documents. some will mutate
// the document definition, some check the definition for errors (undefined fields, etc)
export type Transform<_TransformType> = (config: Config, documents: _TransformType) => Promise<void>

// a pipeline can have dependencies or not
export type Pipeline<_TransformType> = [Transform<_TransformType>[], Pipeline<_TransformType>?]

export type ExecutablePipeline<_TransformType> =
	| Pipeline<_TransformType>
	| Transform<_TransformType>[]

export async function runPipeline<_TransformType>(
	config: Config,
	_p: ExecutablePipeline<_TransformType>,
	target: _TransformType
) {
	// if we were given a flat list, embed it one level down
	const pipeline: Pipeline<_TransformType> = _p[1]
		? (_p as Pipeline<_TransformType>)
		: [_p as Transform<_TransformType>[]]

	// we're going to append transforms that need to be applied
	// start with the initial set of transforms
	let nodesToApply = [...pipeline[0], pipeline[1]]

	// apply every transform we have encountered
	while (nodesToApply.length > 0) {
		// grab the first transform
		const node = nodesToApply.shift()
		// if we got an empty value
		if (!node) {
			// move along
			continue
		}

		// if we are looking at a list
		if (Array.isArray(node)) {
			// add every element in the first entry of the list to the front
			// and all of the dependencies to the back
			nodesToApply = [...node[0], ...nodesToApply, node[1]]

			// we're done, we'll be back to process the contents of this list later
			continue
		}

		// apply the transformation
		await node(config, target)
	}
}
