// external imports
import * as graphql from 'graphql'
import * as recast from 'recast'
// local imports
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { moduleExport, writeFile } from '../../utils'

const AST = recast.types.builders

// the enum generator creates runtime definitions and centralizes the type definitions in a
// single place to avoid conflicting exported types
export default async function enumGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// grab every enum definition in the project's schema
	const enums = graphql
		.parse(graphql.printSchema(config.schema))
		.definitions.filter(
			(definition) => definition.kind === 'EnumTypeDefinition'
		) as graphql.EnumTypeDefinitionNode[]

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

	// write the typedefinition to disk
	await Promise.all([
		writeFile(config.enumTypesDefinitionsPath, typeDefinitions),
		writeFile(config.enumRuntimeDefinitionsPath, runtimeDefinitions),
	])
}
