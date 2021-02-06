import * as graphql from 'graphql'
import fs from 'fs'
import path from 'path'

// the values we can take in from the config file
export type ConfigFile = {
	artifactDirectory: string
	schemaPath?: string
	schema?: string
}

export class Config {
	artifactDirectory: string
	schema: graphql.GraphQLSchema

	constructor({ artifactDirectory, schema, schemaPath }: ConfigFile) {
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
		this.artifactDirectory = artifactDirectory
	}
}

// a place to store the current configuration
let _config: Config

export async function getConfig(): Promise<Config> {
	if (_config) {
		return _config
	}

	return new Config(await import(path.join(process.cwd(), 'houdini.config')))
}
