// externals
import { mergeSchemas } from '@graphql-tools/schema'
import { buildSchema, DefinitionNode, print } from 'graphql'
import fs from 'fs/promises'
import * as graphql from 'graphql'
// locals
import { Config, findScriptInnerBounds } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

// schemaGenerator updates the schema file to contain all of the generated
// definitions
export default async function schemaGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	if (!config.newSchema) {
		return
	}

	// print the updated version of the schema over the existing one
	await fs.writeFile(config.definitionsPath, config.newSchema, 'utf-8')
}
