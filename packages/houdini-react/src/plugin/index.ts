import {
	ArtifactKind,
	ArtifactKinds,
	plugin,
	type Document,
	type Config,
	fragmentKey,
} from 'houdini'
import path from 'path'

import { extractDocuments } from './extract'
import { transformFile } from './transform'

const HoudiniReactPlugin = plugin('houdini-react', async () => ({
	order: 'core',

	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	// include the runtime
	includeRuntime: {
		esm: '../runtime-esm',
		commonjs: '../runtime-cjs',
	},

	// we need to add overloaded definitions for every hook that
	// returns the appropriate type for each document
	transformRuntime: (docs) => {
		// we need to group every document by type
		const documents: { [Kind in ArtifactKinds]?: Document[] } = {}
		for (const doc of docs) {
			if (!doc.generateStore) {
				continue
			}
			if (!documents[doc.kind]) {
				documents[doc.kind] = []
			}
			documents[doc.kind]!.push(doc)
		}

		return {
			'hooks/useQuery.d.ts': ({ config, content }) =>
				addOverload({
					config,
					content,
					name: 'useQuery',
					documents: documents[ArtifactKind.Query] ?? [],
					importIdentifiers: (doc) => [`${doc.name}$result`, `${doc.name}$input`],
					signature: (doc) =>
						`export function useQuery(document: { artifact: { name : "${doc.name}" } }, variables?: ${doc.name}$input, config?: UseQueryConfig): ${doc.name}$result`,
				}),
			'hooks/useQueryHandle.d.ts': ({ config, content }) =>
				addOverload({
					config,
					content,
					name: 'useQueryHandle',
					documents: documents[ArtifactKind.Query] ?? [],
					preamble: 'import { DocumentHandle } from "./useDocumentHandle"',
					importIdentifiers: (doc) => [
						`${doc.name}$result`,
						`${doc.name}$artifact`,
						`${doc.name}$input`,
					],
					signature: (doc) =>
						`export function useQueryHandle(document: { artifact: { name : "${doc.name}" } }, variables?: ${doc.name}$input, config?: UseQueryConfig): DocumentHandle<${doc.name}$artifact, ${doc.name}$result, ${doc.name}$input>`,
				}),
			'hooks/useFragment.d.ts': ({ config, content }) =>
				addOverload({
					config,
					content,
					name: 'useFragment',
					documents: documents[ArtifactKind.Fragment] ?? [],
					importIdentifiers: (doc) => [`${doc.name}$data`],
					signature: (doc) =>
						`export function useFragment(reference: { readonly "${fragmentKey}": { ${doc.name}: any } }, document: { artifact: { name : "${doc.name}" } }): ${doc.name}$data`,
				}),
			'hooks/useFragmentHandle.d.ts': ({ config, content }) =>
				addOverload({
					config,
					content,
					name: 'useFragmentHandle',
					documents: documents[ArtifactKind.Fragment] ?? [],
					preamble: 'import { DocumentHandle } from "./useDocumentHandle"',
					importIdentifiers: (doc) => [
						`${doc.name}$data`,
						`${doc.name}$artifact`,
						`${doc.name}$input`,
					],
					signature: (doc) =>
						`export function useFragmentHandle(reference: { readonly "${fragmentKey}": { ${doc.name}: any } }, document: { artifact: { name : "${doc.name}" } }): DocumentHandle<${doc.name}$artifact, ${doc.name}$result, ${doc.name}$input>`,
				}),
			'hooks/useMutation.d.ts': ({ config, content }) =>
				addOverload({
					config,
					content,
					name: 'useMutation',
					documents: documents[ArtifactKind.Mutation] ?? [],
					importIdentifiers: (doc) => [
						`${doc.name}$result`,
						`${doc.name}$input`,
						`${doc.name}$optimistic`,
					],
					signature: (doc) =>
						`export function useMutation(document: { artifact: { name : "${doc.name}" } }): [MutationHandler<${doc.name}$result, ${doc.name}$input, ${doc.name}$optimistic>, boolean]`,
				}),
			'hooks/useSubscription.d.ts': ({ config, content }) =>
				addOverload({
					config,
					content,
					name: 'useSubscription',
					documents: documents[ArtifactKind.Subscription] ?? [],
					importIdentifiers: (doc) => [`${doc.name}$result`, `${doc.name}$input`],
					signature: (doc) =>
						`export function useSubscription(document: { artifact: { name : "${doc.name}" } }, variables?: ${doc.name}$input): ${doc.name}$result`,
				}),
			'hooks/useSubscriptionHandle.d.ts': ({ config, content }) =>
				addOverload({
					config,
					content,
					name: 'useSubscriptionHandle',
					documents: documents[ArtifactKind.Subscription] ?? [],
					importIdentifiers: (doc) => [`${doc.name}$result`, `${doc.name}$input`],
					signature: (doc) =>
						`export function useSubscriptionHandle(document: { artifact: { name : "${doc.name}" } }, variables?: ${doc.name}$input): SubscriptionHandle<${doc.name}$result, ${doc.name}$input>`,
				}),
		}
	},

	// transform the type definitions to have overloaded signatures for
	// every document in the project

	// we need to teach the codegen how to get graphql documents from jsx files
	extractDocuments,

	// convert the graphql template tags into references to their artifact
	transformFile,

	graphqlTagReturn({ config, document: doc, ensureImport: ensure_import }) {
		// if we're supposed to generate a store then add an overloaded declaration
		if (doc.generateStore) {
			const variableName = `${doc.name}$artifact`

			ensure_import({
				identifier: variableName,
				module: config.artifactImportPath(doc.name).replaceAll('$houdini', '..'),
			})

			// and use the store as the return value
			return `{ artifact: ${variableName} }`
		}
	},
}))

function addOverload({
	config,
	content,
	name,
	documents,
	signature,
	preamble,
	importIdentifiers,
}: {
	config: Config
	content: string
	name: string
	documents: Document[]
	signature: (doc: Document) => string
	preamble?: string
	importIdentifiers: (doc: Document) => string[]
}): string {
	// find the index of the function's definition
	let definitionIndex = content.indexOf(`export declare function ${name}`)
	if (definitionIndex === -1) {
		return content
	}

	// lets start off by importing all of the necessary types for each artifact
	const docImports = documents
		.filter((doc) => doc.generateStore)
		.map(
			(doc) => `
import type { ${importIdentifiers(doc).join(', ')} } from '${path.relative(
				path.relative(
					config.projectRoot,
					path.join(config.pluginRuntimeDirectory('houdini-react'), 'hooks')
				),
				config.artifactImportPath(doc.name)
			)}'
	`
		)
		.join('\n')

	return `${docImports}
${preamble ?? ''}
${
	content.slice(0, definitionIndex) +
	documents.map(signature).join('\n') +
	'\n' +
	content.slice(definitionIndex)
}
`
}

export default HoudiniReactPlugin

export type HoudiniReactPluginConfig = {}
