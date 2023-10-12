import type * as graphql from 'graphql'
import path from 'node:path'

import type { Config } from '../config'
import { type ConfigFile, localApiEndpoint } from '../types'

export function isSecondaryBuild() {
	return process.env.HOUDINI_SECONDARY_BUILD && process.env.HOUDINI_SECONDARY_BUILD !== 'false'
}

export function internalRoutes(config: ConfigFile): string[] {
	const routes = [localApiEndpoint(config)]
	if (config.router?.auth && 'redirect' in config.router.auth) {
		routes.push(config.router.auth.redirect)
	}

	return routes
}

export async function buildLocalSchema(config: Config): Promise<void> {
	// before we build the local schcema, we need to generate the typescript config file
	// so that we can resolve all of the necessary imports
	console.log('building local schema')

	// load the current version of vite
	const { build } = await import('vite')

	process.env.HOUDINI_SECONDARY_BUILD = 'true'

	// build the schema somewhere we can import from
	await build({
		logLevel: 'silent',
		build: {
			outDir: path.join(config.rootDir, 'temp'),
			rollupOptions: {
				input: {
					schema: path.join(config.localApiDir, '+schema'),
				},
				output: {
					entryFileNames: 'assets/[name].js',
				},
			},
			ssr: true,
		},
	})

	console.log('done building local schema')

	process.env.HOUDINI_SECONDARY_BUILD = 'false'
}

export async function loadLocalSchema(config: Config): Promise<graphql.GraphQLSchema> {
	await buildLocalSchema(config)

	console.log('after schema build')

	// import the schema we just built
	try {
		const { default: schema } = await import(
			path.join(config.rootDir, 'temp', 'assets', 'schema.js')
		)
		console.log('after schema import')

		return schema
	} catch (e) {
		console.log(e)
		throw e
	}
}
