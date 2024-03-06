import * as graphql from 'graphql'

import type { Config, Document } from '../../lib'

// componentFields verifies that no two @componentFields overlap with each other
// or the schema
export default async function componentFields(config: Config, docs: Document[]): Promise<void> {
	// collect the errors
	const errors: { message: string; filepath: string; description?: string }[] = []

	for (const { filename: filepath, document } of docs) {
		graphql.visit(document, {
			FragmentDefinition(node, _, __, ___, ancestors) {
				const componentFieldDirective = node.directives?.find(
					(dir) => dir.name.value === config.componentFieldDirective
				)
				if (!componentFieldDirective) {
					return
				}

				// make sure the feature flag is on
				if (!config.configFile.features?.componentFields) {
					errors.push({
						filepath,
						message: `⚠️  You must enable the componentFields feature flag to use the @${config.componentFieldDirective} directive`,
						description:
							'For more information, visit: https://houdinigraphql.com/api/react#component-fields',
					})
					return
				}

				// get the raw component field info
				const parent = node.typeCondition.name.value
				let fieldArg: graphql.ArgumentNode | null = null
				let propArg: graphql.ArgumentNode | null = null
				for (const arg of componentFieldDirective.arguments ?? []) {
					if (arg.name.value === 'field') {
						fieldArg = arg
					} else if (arg.name.value === 'prop') {
						propArg = arg
					}
				}

				// make typescript happy
				if (!fieldArg) {
					errors.push({
						message: `Missing field argument on @${config.componentFieldDirective} directive`,
						filepath,
					})
					return
				}

				// componentFields applied directly to fragment definitions need to have a prop argument
				if (!propArg) {
					errors.push({
						message: `Missing prop argument on @${config.componentFieldDirective} directive`,
						filepath,
					})
					return
				}

				// if we got this far, we have a field and prop argument

				// get the value of the 2 props
				const fieldValue =
					fieldArg!.value?.kind === 'StringValue' ? fieldArg.value.value : undefined
				const propValue =
					propArg!.value?.kind === 'StringValue' ? propArg.value.value : undefined

				// look up if we've already seen this component field before
				const existingField = fieldValue && config.componentFields[parent]?.[fieldValue]

				// look up the type of the parent
				const parentType = config.schema.getType(parent)
				let conflict = false
				if (existingField && existingField.filepath !== filepath) {
					conflict = true
				} else if (parentType && fieldValue) {
					const fieldDef =
						graphql.isObjectType(parentType) && parentType.getFields()[fieldValue]
					if (
						fieldDef &&
						!fieldDef.astNode?.directives?.find(
							(dir) => dir.name.value === config.componentFieldDirective
						)
					) {
						conflict = true
					}
				}

				if (conflict) {
					errors.push({
						message:
							`Duplicate component field definition for ${parent}.${fieldValue}.` +
							(existingField
								? 'The conflicting component field was defined in ' +
								  existingField.filepath
								: ''),
						filepath,
					})
				}

				// if the type is abstract there's a problem
				if (parentType && graphql.isAbstractType(parentType)) {
					errors.push({
						message: `Cannot add component field ${parent}.${fieldValue} because ${parent} is an abstract type`,
						filepath,
					})
					return
				}

				// save the reference to the directive
				if (fieldValue && propValue) {
					config.componentFields[parent] = {
						...config.componentFields[parent],
						[fieldValue]: {
							directive: componentFieldDirective,
							fragment: node.name.value,
							filepath,
							prop: propValue,
							parent: node,
						},
					}
				}
			},
		})
	}

	// if we got errors
	if (errors.length > 0) {
		throw errors
	}

	// we're done here
	return
}
