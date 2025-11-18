import type { Config } from './config.js'

// transforms are functions that takes the collected documents. some will mutate
// the document definition, some check the definition for errors (undefined fields, etc)
export type Transform<_TransformType> =
	| null
	| ((config: Config, documents: _TransformType) => Promise<void> | void)

export async function runPipeline<_TransformType>(
	config: Config,
	pipeline: Transform<_TransformType>[],
	target: _TransformType
) {
	for (const transform of pipeline) {
		await transform?.(config, target)
	}
}
