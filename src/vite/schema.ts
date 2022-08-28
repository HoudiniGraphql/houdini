import { sleep } from '@kitql/helper'
import glob from 'glob'
import path from 'path'
import { Plugin } from 'vite'

import { pullSchema } from '../cmd/utils'
import { formatErrors, getConfig } from '../common'

export default function HoudiniWatchSchemaPlugin(configFile?: string): Plugin {
	let go = true

	return {
		name: 'houdini-watch-schema',
		apply: 'serve',
		async buildStart() {
			const config = await getConfig({ configFile })

			// validate the config

			// if there's no api url set, there's nothing to poll
			if (!config.apiUrl) {
				return
			}

			// if the schema path is a glob, there's no reason to poll (the schema is already local)
			if (config.schemaPath && glob.hasMagic(config.schemaPath)) {
				return
			}

			const interval = config.schemaPollInterval

			// an interval of null means no initial poll
			if (interval === null) {
				return
			}
			// the function to call on the appropriate interval
			async function pull(poll: boolean) {
				try {
					// Write the schema
					await pullSchema(
						config.apiUrl!,
						config.schemaPath ?? path.resolve(process.cwd(), 'schema.json'),
						config.pullHeaders
					)
				} catch (e) {
					formatErrors(e)
				}

				// if we are supposed to poll, wait the appropriate amount of time and then do it again
				if (poll) {
					await sleep(interval!)

					if (go) {
						pull(poll)
					}
				}
			}

			// its safe to pull the schema
			await pull(false)

			// if we aren't supposed to poll at all
			if (interval <= 0) {
				return
			}

			// wait once before starting the loop
			await sleep(interval)

			// start listening
			await pull(true)
		},
		buildEnd() {
			go = false
		},
	}
}
