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

				// look up the type of the parent
				const parentType = config.schema.getType(parent)
				if (
					parentType &&
					fieldValue &&
					((graphql.isObjectType(parentType) && parentType.getFields()[fieldValue]) ||
						config.componentFields[parent]?.[fieldValue])
				) {
					errors.push({
						message: `Duplicate component field definition for ${parent}.${fieldValue}`,
						filepath,
					})
				}

				// save the reference to the directive
				if (fieldValue) {
					config.componentFields[parent] = {
						...config.componentFields[parent],
						[fieldValue]: {
							directive: componentFieldDirective,
							fragment: node.name.value,
							filepath,
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
