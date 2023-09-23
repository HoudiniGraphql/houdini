import type * as graphql from 'graphql'
import path from 'node:path'
import { build } from 'vite'

import type { Config } from '../lib/config'

export function isSecondaryBuild() {
	return process.env.HOUDINI_SCHEMA_BUILD === 'true'
}

export async function loadLocalSchema(config: Config): Promise<graphql.GraphQLSchema> {
	process.env.HOUDINI_SCHEMA_BUILD = 'true'

	// build the schema somewhere we can import from
	await build({
		logLevel: 'silent',
		build: {
			outDir: path.join(config.rootDir, 'temp'),
			rollupOptions: {
				input: {
					schema: path.join(config.localApiDir, '+schema'),
				},
				external: ['graphql'],
			},
			lib: {
				entry: {
					schema: path.join(config.localApiDir, '+schema'),
				},
				formats: ['es'],
			},
		},
	})

	process.env.HOUDINI_SCHEMA_BUILD = 'false'

	// import the schema we just built
	const { default: schema } = await import(
		path.join(config.rootDir, 'temp', 'assets', 'schema.js')
	)

	return schema
}
