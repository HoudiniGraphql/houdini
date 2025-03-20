import * as graphql from 'graphql'
import path from 'node:path'

import type { Config } from '../config'
import * as fs from '../fs'
import { localApiEndpoint, type ConfigFile } from '../types'
import * as routerConventions from './conventions'

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
	// before we build the local schcema, we should check if it already exists
	// so we dont do it again

	// load the current version of vite
	const { build } = await import('vite')

	const schema = path.join(config.localApiDir, '+schema')
	const outDir = routerConventions.temp_dir(config, 'schema')

	process.env.HOUDINI_SECONDARY_BUILD = 'true'

	try {
		await fs.remove(path.join(outDir, 'assets', 'schema.js'))
	} catch {}

	try {
		await fs.mkdir(outDir)
	} catch {}

	// build the schema somewhere we can import from
	await build({
		logLevel: 'silent',
		build: {
			outDir,
			rollupOptions: {
				input: {
					schema,
				},
				output: {
					entryFileNames: '[name].js',
				},
			},
			ssr: true,
			lib: {
				entry: {
					schema,
				},
				formats: ['es'],
			},
		},
	})

	process.env.HOUDINI_SECONDARY_BUILD = 'false'
}

export async function loadLocalSchema(config: Config): Promise<graphql.GraphQLSchema> {
	if (!isSecondaryBuild()) {
		await buildLocalSchema(config)
	}

	// import the schema we just built
	try {
		const { default: schema } = await import(
			path.join(
				routerConventions.temp_dir(config, 'schema'),
				`schema.js?${Date.now().valueOf()}}`
			)
		)

		return schema
	} catch (e) {
		const message = 'message' in (e as Error) ? (e as Error).message : e
		// if we fail to load the schema, log a message to the user and just return an empty one
		console.error('⚠️ Failed to load local schema: ', message)
		return new graphql.GraphQLSchema({})
	}
}
