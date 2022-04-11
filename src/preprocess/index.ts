// externals
import { getConfig } from '~/common'
// locals
import applyTransforms from './transforms'

// the main entry point for the preprocessor
export default function houdiniPreprocessor() {
	return {
		async markup({ content, filename }: { content: string; filename: string }) {
			// grab the config
			const config = await getConfig()

			// apply the transform pipeline
			return await applyTransforms(config, { content, filename })
		},
	}
}
