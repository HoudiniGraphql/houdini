import * as graphql from 'graphql'
import path from 'path'
import * as recast from 'recast'
import typeScriptParser from 'recast/parsers/typescript'
import { beforeEach, expect } from 'vitest'

import { fs } from './packages/houdini/src/lib'
import { clearMock, testConfig } from './packages/houdini/src/test'

process.env.HOUDINI_TEST = 'true'

beforeEach(clearMock)

const config = testConfig()

// serialize artifact references
expect.addSnapshotSerializer({
	test: (val) => val?.document && fs.existsSync(config.artifactPath(val.document)),
	serialize(value) {
		// assuming that the value we were given is a collected document, figure
		// out the path holding the artifact
		const artifactPath = path.join('$houdini/artifacts', documentName(value.document) + '.js')

		const artifactContents = fs.readFileSync(artifactPath)
		expect(artifactContents).toBeTruthy()

		// parse the contents
		const parsed = recast.parse(artifactContents!, {
			parser: typeScriptParser,
		}).program

		// @ts-ignore
		return recast.print(parsed).code.replaceAll(config.projectRoot, 'PROJECT_ROOT')
	},
})

// serialize javascript ASTs
expect.addSnapshotSerializer({
	test: (val) => val && Object.keys(recast.types.namedTypes).includes(val.type),
	serialize: (val) => {
		return recast.print(val).code.replaceAll(config.projectRoot, 'PROJECT_ROOT')
	},
})

// serialize
expect.addSnapshotSerializer({
	test: (val) => val && Object.values(graphql.Kind).includes(val.kind),
	serialize: (val) => graphql.print(val),
})

expect.addSnapshotSerializer({
	test: (val) =>
		val &&
		!Object.values(graphql.Kind).includes(val.kind) &&
		!Object.keys(recast.types.namedTypes).includes(val.type) &&
		!val.document,
	serialize: (val) => {
		return JSON.stringify(val, null, 4)
	},
})

function documentName(document: graphql.DocumentNode) {
	// if there is an operation in the document
	const operation = document.definitions.find(
		({ kind }) => graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode | null
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
	) as graphql.FragmentDefinitionNode[]
	if (fragmentDefinitions.length) {
		// join all of the fragment definitions into one
		return fragmentDefinitions.map((fragment) => fragment.name).join('_')
	}

	// we don't know how to generate a name for this document
	throw new Error('Could not generate artifact name for document: ' + graphql.print(document))
}
