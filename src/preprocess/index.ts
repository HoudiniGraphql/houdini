import { logGreen } from '@kitql/helper'

import { getConfig } from '../common'
import transform from '../kit/transforms'
import { ConfigFile } from '../runtime'

/**
 * The houdini processor automates a lot of boilerplate to make inline documents
 * work.
 *
 * It takes the same configuration values as the houdini config file as well as an
 * optional `configFile` parameter to specify the path to use to find houdini.config.js
 */
export default function houdiniPreprocessor(
	extraConfig: { configFile?: string } & Partial<ConfigFile>
) {
	return {
		async markup({ content, filename }: { content: string; filename: string }) {
			// grab the config
			const config = await getConfig(extraConfig)

			// if we detected a kit project using the preprocessor, tell them they need to update
			if (config.framework === 'kit') {
				throw new Error(`⚠️ houdini/preprocess has been replaced by houdini/kit.
Please remove the preprocessor from your svelte.config.js and update your vite.config.js to look like the following 👇

Order for plugins is important. Make sure houdini comes before sveltekit.

import { sveltekit } from '@sveltejs/kit/vite';
${logGreen("import 'houdini' from 'houdini/kit';")}

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [${logGreen('houdini()')}, sveltekit()] 
};

export default config;
`)
			}

			// build up the necessary context to run the vite transform
			const page = {
				config,
				filepath: filename,
				watch_file: () => {},
				load: async (fp: string) => await import(fp),
			}

			// apply the transform pipeline
			return await transform(config, page, content)
		},
	}
}
