const recast = require('recast')
const graphql = require('graphql')
const mockFs = require('mock-fs')
const path = require('path')
const { toMatchInlineSnapshot } = require('jest-snapshot')
const fs = require('fs/promises')
const typeScriptParser = require('recast/parsers/typescript')

process.env.TEST = 'true'

expect.addSnapshotSerializer({
	test: (val) => val && Object.keys(recast.types.namedTypes).includes(val.type),
	serialize: (val) => {
		return recast.print(val).code
	},
})

expect.addSnapshotSerializer({
	test: (val) => val && Object.values(graphql.Kind).includes(val.kind),
	serialize: (val) => graphql.print(val),
})

expect.addSnapshotSerializer({
	test: (val) =>
		val &&
		!Object.values(graphql.Kind).includes(val.kind) &&
		!Object.keys(recast.types.namedTypes).includes(val.type),
	serialize: (val) => {
		return JSON.stringify(val, null, 4)
	},
})

expect.extend({
	async toMatchArtifactSnapshot(value, ...rest) {
		// The error (and its stacktrace) must be created before any `await`
		this.error = new Error()

		// assuming that the value we were given is a collected document, figure
		// out the path holding the artifact
		const artifactPath = path.join('$houdini/artifacts', documentName(value.document) + '.js')

		const artifactContents = await fs.readFile(artifactPath, 'utf-8')

		// parse the contents
		const parsed = recast.parse(artifactContents, {
			parser: typeScriptParser,
		}).program

		return toMatchInlineSnapshot.call(this, parsed, ...rest)
	},
})

beforeEach(() => {
	mockFs({
		$houdini: {
			artifacts: {},
			runtime: {},
			stores: {},
		},
		// the runtime generator copies files relative to import.meta.url. we need our tests
		// to point to the same filestructure that will exist
		[`build/runtime-esm`]: mockFs.load(path.resolve('build', 'runtime-esm')),
		[`build/runtime-cjs`]: mockFs.load(path.resolve('build', 'runtime-cjs')),
	})
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)

function documentName(document) {
	// if there is an operation in the document
	const operation = document.definitions.find(({ kind }) => graphql.Kind.OPERATION_DEFINITION)
	if (operation) {
		// if the operation does not have a name
		if (!operation.name) {
			// we can't give them a file
			throw new Error('encountered operation with no name: ' + graphql.print(document))
		}

		// use the operation name for the artifact
		return operation.name.value
	}

	// look for a fragment definition
	const fragmentDefinitions = document.definitions.filter(
		({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
	)
	if (fragmentDefinitions.length) {
		// join all of the fragment definitions into one
		return fragmentDefinitions.map((fragment) => fragment.name).join('_')
	}

	// we don't know how to generate a name for this document
	throw new Error('Could not generate artifact name for document: ' + graphql.print(document))
}
