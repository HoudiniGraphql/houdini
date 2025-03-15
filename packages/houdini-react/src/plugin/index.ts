import type { FragmentDefinitionNode } from 'graphql'
import {
	ArtifactKind,
	plugin,
	fragmentKey,
	load_manifest,
	processComponentFieldDirective,
	type ArtifactKinds,
	type Document,
	type Config,
	type Plugin,
} from 'houdini'
import path from 'node:path'
import { loadEnv } from 'vite'

import generate from './codegen'
import { format_router_manifest } from './codegen/router'
import { extractDocuments } from './extract'
import { transformFile } from './transform'
import vite_plugin from './vite'
import { manifest, setManifest } from './state'

export const hooks: Plugin = async () => ({
	order: 'core',

	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	// always make sure our definition of the manifest is up to date before
	// we generate anything
	async beforeGenerate({ config }) {
		try {
			setManifest(await load_manifest({ config }))
		} catch (e) {
			console.log('something went wrong: ' + (e as Error).message)
			return
		}
	},

	// include the runtime
	includeRuntime: {
		esm: '../runtime-esm',
		commonjs: '../runtime-cjs',
	},

	clientPlugins: {
		'$houdini/plugins/houdini-react/runtime/clientPlugin': null,
	},

	vite: vite_plugin,

	// we need to add overloaded definitions for every hook that
	// returns the appropriate type for each document
	transformRuntime: (docs, { config }) => {
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

		// fragment definitions that are tagged with the component field directive
		// indicate a componentField inline fragment
		const componentFields: Record<string, string> = {}
		for (const { document } of Object.values(documents[ArtifactKind.Fragment] ?? {})) {
			for (const def of document.definitions) {
				const definition = def as FragmentDefinitionNode
				// if the fragment doesn't have the component field directive then skip it
				const directive = definition.directives?.find(
					(d) => d.name.value === config.componentFieldDirective
				)
				if (!directive) {
					continue
				}

				const { raw } = processComponentFieldDirective(directive)
				if (!raw) {
					continue
				}

				componentFields[definition.name.value] = raw
			}
		}

		return {
			'client.js': ({ config, exportDefaultStatement, importStatement }) => {
				// all we need to do is import the client from the fixed
				// location and export as the default
				const runtimeFilePath = path.join(
					config.pluginRuntimeDirectory('houdini-react'),
					'config.js'
				)

				// the relative path
				const relativePath = path.relative(
					path.dirname(runtimeFilePath),
					path.join(config.projectRoot, 'src', '+client')
				)

				return `${importStatement(relativePath, 'client')}
	${exportDefaultStatement('() => client')}
	`
			},
			'manifest.js': ({ config, exportDefaultStatement, importStatement }) => {
				// we need to generate a manifest for the runtime router
				return format_router_manifest({
					config,
					manifest,
					exportDefaultStatement,
					importStatement,
				})
			},

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
						`export function useFragment(reference: { readonly "${fragmentKey}": { ${doc.name}: any } }, document: { artifact: { name : "${doc.name}" } }): ${doc.name}$data
export function useFragment(reference: { readonly "${fragmentKey}": { ${doc.name}: any } } | null, document: { artifact: { name : "${doc.name}" } }): ${doc.name}$data | null`,
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
						`export function useFragmentHandle(reference: { readonly "${fragmentKey}": { ${doc.name}: any } }, document: { artifact: { name : "${doc.name}" } }): DocumentHandle<${doc.name}$artifact, ${doc.name}$result, ${doc.name}$input>
export function useFragmentHandle(reference: { readonly "${fragmentKey}": { ${doc.name}: any } } | null, document: { artifact: { name : "${doc.name}" } }): DocumentHandle<${doc.name}$artifact, ${doc.name}$result | null, ${doc.name}$input>`,
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
						`export function useMutation(document: { artifact: { name : "${doc.name}" } }): [boolean, MutationHandler<${doc.name}$result, ${doc.name}$input, ${doc.name}$optimistic>]`,
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
			'index.d.ts': ({ content, importStatement }) => {
				// we're just going to add the GraphQL type to the end of the file

				// but we need to import the fragment types for every component field
				// from the generated runtime

				let preamble = ''
				let fields = ''
				for (const [fragmentName, document] of Object.entries(componentFields)) {
					preamble += `import type { ${fragmentName} } from '$houdini'\n`
					fields += `_Document extends \`${document}\` ? Required<${fragmentName}>['shape']`
				}

				return (
					preamble +
					content +
					`
	export type GraphQL<_Document extends string> = ` +
					fields +
					': never\n'
				)
			},
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
				module: config.artifactImportPath(doc.name).replace(/\$houdini/g, '..'),
			})

			// and use the store as the return value
			return `{ artifact: ${variableName} }`
		}
	},

	generate(args) {
		return generate({
			...args,
			manifest,
		})
	},

	async env({ config }) {
		if (_env) {
			return _env
		}

		// load the vite config
		_env = loadEnv('dev', config.projectRoot || '.', '')

		return _env
	},
})

let _env: Record<string, string>

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

export default plugin('houdini-react', hooks)

export type HoudiniReactPluginConfig = {}

