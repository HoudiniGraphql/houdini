import { sleep } from '@kitql/helpers'
import type { Plugin } from 'vite'

import type { PluginConfig } from '../lib'
import { formatErrors, getConfig, pullSchema, path, fs } from '../lib'

export function watch_remote_schema(opts: PluginConfig = {}): Plugin {
	let go = true

	return {
		name: 'houdini-watch-remote-schema',
		apply: 'serve',
		async buildStart() {
			const config = await getConfig(opts)
			let nbPullError = 0

			// validate the config
			const apiURL = await config.apiURL()

			// if there's no api url set, there's nothing to poll
			if (!apiURL) {
				return
			}

			// if the schema path is a glob, there's no reason to poll (the schema is already local)
			if (config.schemaPath && fs.glob.hasMagic(config.schemaPath)) {
				return
			}

			const interval = config.schemaPollInterval

			// an interval of null means no initial poll
			if (interval === null) {
				return
			}

			// the function to call on the appropriate interval
			async function pull(more: boolean) {
				try {
					// Write the schema
					const schemaState = await pullSchema(
						apiURL!,
						config.schemaPollTimeout,
						config.schemaPath ?? path.resolve(process.cwd(), 'schema.json'),
						await config.pullHeaders()
					)

					nbPullError = schemaState ? 0 : nbPullError + 1
				} catch (e) {
					formatErrors(e)
				}

				// if we are supposed to poll more, wait the appropriate amount of time and then do it again
				if (more) {
					// Wait more and more and more...
					const timeToWait = interval! + interval! * nbPullError
					await sleep(timeToWait)

					if (go) {
						pull(more)
					}
				}
			}

			// its safe to pull the schema
			await pull(false)

			// if we aren't supposed to poll at all
			if (interval <= 0) {
				return
			}

			async function sleepAndStartPullLoop(interval: number) {
				// wait once before starting the loop
				await sleep(interval)

				// start listening
				await pull(true)
			}

			sleepAndStartPullLoop(interval)
		},
		buildEnd() {
			go = false
		},
	}
}

// Local schema is now watched by the houdini vite plugin on hotUpdate
// export function watch_local_schema(ref: { list: string[] }): Plugin