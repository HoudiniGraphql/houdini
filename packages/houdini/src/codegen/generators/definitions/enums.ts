import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config, fs, path } from '../../../lib'
import { moduleExport } from '../../utils'

const AST = recast.types.builders

// the enum generator creates runtime definitions and centralizes the type definitions in a
// single place to avoid conflicting exported types
export default async function definitionsGenerator(config: Config) {
	// grab every enum definition in the project's schema
	const enums = (
		graphql
			.parse(graphql.printSchema(config.schema))
			.definitions.filter(
				(definition) => definition.kind === 'EnumTypeDefinition'
			) as graphql.EnumTypeDefinitionNode[]
	).filter((def) => !config.isInternalEnum(def))

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
		.sort((a, b) => a.name.value.localeCompare(b.name.value))
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
export * from './enums.js'
	`

	// write the typedefinition to disk
	await Promise.all([
		fs.writeFile(config.enumTypesDefinitionsPath, typeDefinitions),
		fs.writeFile(config.enumRuntimeDefinitionsPath, runtimeDefinitions),
		fs.writeFile(path.join(config.definitionsDirectory, 'index.js'), definitionsIndex),
		fs.writeFile(path.join(config.definitionsDirectory, 'index.d.ts'), definitionsIndex),
	])
}
