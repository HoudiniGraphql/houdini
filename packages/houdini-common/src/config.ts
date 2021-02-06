import * as graphql from 'graphql'
import fs from 'fs'
import path from 'path'

// the values we can take in from the config file
export type ConfigFile = {
	runtimeDirectory: string
	sourceGlob: string
	schemaPath?: string
	schema?: string
	quiet?: boolean
}

export class Config {
	runtimeDirectory: string
	schema: graphql.GraphQLSchema
	sourceGlob: string
	quiet: boolean

	constructor({ runtimeDirectory, schema, schemaPath, sourceGlob, quiet = false }: ConfigFile) {
		// make sure we got some kind of schema
		if (!schema && !schemaPath) {
			throw new Error('Please provide one of schema or schema path')
		}

		// if we're given a schema string
		if (schema) {
			this.schema = graphql.buildSchema(schema)
		} else {
			this.schema = graphql.buildClientSchema(
				JSON.parse(fs.readFileSync(schemaPath as string, 'utf-8'))
			)
		}

		// hold onto the artifact directory
		this.runtimeDirectory = runtimeDirectory
		this.sourceGlob = sourceGlob
		this.quiet = quiet
	}

	// the directory where we put all of the artifacts
	get artifactDirectory() {
		return path.join(this.runtimeDirectory, 'artifacts')
	}

	// the location for an
	artifactPath(name: string): string {
		return path.join(this.artifactDirectory, `${name}.js`)
	}
}

export function testConfig(config: {}) {
	return new Config({
		runtimeDirectory: path.resolve(process.cwd(), 'generated'),
		sourceGlob: '123',
		schema: `type Query { version: Int! }`,
		quiet: true,
		...config,
	})
}

// a place to store the current configuration
let _config: Config

export async function getConfig(): Promise<Config> {
	if (_config) {
		return _config
	}

	return new Config(await import(path.join(process.cwd(), 'houdini.config')))
}
