import * as graphql from 'graphql'

import { unwrapType, wrapType, type Config, type Document } from '../../package/lib'

// for the purposes of the rest of the pipeline, a runtime scalar should be considered the same as
// its GraphQL type. This transform converts the definitions and leaves behind a directive that
// the pipeline can use to detect if a variable is fulled at runtime.
export default async function addTypename(config: Config, documents: Document[]): Promise<void> {
	// visit every document
	for (const doc of documents) {
		// update the document (graphql.visit is pure)
		doc.document = graphql.visit(doc.document, {
			VariableDefinition(node) {
				// get the name of the type
				const { type, wrappers } = unwrapType(config, node.type)

				const runtimeScalar = config.configFile.features?.runtimeScalars?.[type.name]
				if (runtimeScalar) {
					return {
						...node,
						type: wrapType({
							type: config.schema.getType(runtimeScalar.type)!,
							wrappers,
						}),
						directives: [
							...(node.directives ?? []),
							{
								kind: 'Directive',
								name: {
									kind: 'Name',
									value: config.runtimeScalarDirective,
								},
								arguments: [
									{
										kind: 'Argument',
										name: { kind: 'Name', value: 'type' },
										value: {
											kind: 'StringValue',
											value: type.name,
										},
									},
								],
							} as graphql.DirectiveNode,
						],
					}
				}
			},
		})
	}
}
