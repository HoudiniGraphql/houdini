// locals
import { getConfig } from '../common'
import { ConfigFile } from '../runtime'
import applyTransforms from './transforms'

// the main entry point for the preprocessor
export default function houdiniPreprocessor(extraConfig?: Partial<ConfigFile>) {
	return {
		async markup({ content, filename }: { content: string; filename: string }) {
			// grab the config
			const config = await getConfig(extraConfig)

			// apply the transform pipeline
			return await applyTransforms(config, { content, filename })
		},
	}
}
