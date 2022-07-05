// external imports
import * as graphql from 'graphql'
import * as recast from 'recast'
import path from 'path'
// local imports
import { Config } from '../../../common'
import { moduleExport, writeFile } from '../../utils'

const AST = recast.types.builders

// the enum generator creates runtime definitions and centralizes the type definitions in a
// single place to avoid conflicting exported types
export default async function definitionsGenerator(config: Config) {
	// grab every enum definition in the project's schema
	const enums = (graphql
		.parse(graphql.printSchema(config.schema))
		.definitions.filter(
			(definition) => definition.kind === 'EnumTypeDefinition'
		) as graphql.EnumTypeDefinitionNode[]).filter((def) => !config.isInternalEnum(def))

	// generate the runtime definitions
	const runtimeDefinitions = recast.print(
		AST.program(
			enums.map((defn) => {
				const name = defn.name.value

				return moduleExport(
					config,
					name,
					AST.objectExpression(
						defn.values?.map((value) => {
							const str = value.name.value
							return AST.objectProperty(
								AST.stringLiteral(str),
								AST.stringLiteral(str)
							)
						}) || []
					)
				)
			})
		)
	).code

	// generate the type definitions
	const typeDefinitions = enums
		.map(
			(definition) => `
export declare enum ${definition.name.value} {
${definition.values?.map((value) => `    ${value.name.value} = "${value.name.value}"`).join(',\n')}
}
 `
		)
		.join('')

	// the index file for the definitions directory
	const definitionsIndex = `
export * from './enums'
	`

	// write the typedefinition to disk
	await Promise.all([
		writeFile(config.enumTypesDefinitionsPath, typeDefinitions),
		writeFile(config.enumRuntimeDefinitionsPath, runtimeDefinitions),
		writeFile(path.join(config.definitionsDirectory, 'index.js'), definitionsIndex),
		writeFile(path.join(config.definitionsDirectory, 'index.d.ts'), definitionsIndex),
	])
}
