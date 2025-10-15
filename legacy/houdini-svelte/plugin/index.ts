import type { Config, PluginHooks } from 'houdini'
import generate from './codegen'
import {
	resolve_relative,
	store_import_path,
	store_name,
	stores_directory,
	type Framework,
} from './kit'
import apply_transforms from './transforms'

let framework: Framework = 'svelte'

export let _config: Config

export const pluginHooks = async (): Promise<PluginHooks> => ({
	// we need to write the svelte specific runtime
	generate(input) {
		return generate({
			...input,
			framework,
		})
	},


	/**
	 * Transform
	 */

	// transform a file's contents. changes here aren't seen by extractDocuments
	transformFile(page) {
		return apply_transforms(framework, page)
	},

})


export default plugin('houdini-svelte', pluginHooks)

