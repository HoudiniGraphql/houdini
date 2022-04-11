const recast = require('recast')
const graphql = require('graphql')
const { testConfig } = require('~/common')
const mockFs = require('mock-fs')
const path = require('path')
const { toMatchInlineSnapshot } = require('jest-snapshot')
const fs = require('fs/promises')
const typeScriptParser = require('recast/parsers/typescript')

process.env.TEST = 'true'

// the config to use in tests
const config = testConfig()

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
		const path = config.artifactPath(value.document)

		const artifactContents = await fs.readFile(path, 'utf-8')

		// parse the contents
		const parsed = recast.parse(artifactContents, {
			parser: typeScriptParser,
		}).program

		return toMatchInlineSnapshot.call(this, parsed, ...rest)
	},
})

beforeEach(() => {
	mockFs({
		[path.relative(process.cwd(), config.rootDir)]: {
			[path.relative(config.rootDir, config.artifactDirectory)]: {},
			[path.relative(config.rootDir, config.runtimeDirectory)]: {},
		},
		// the runtime generator copies files relative to __dirname. we need our tests
		// to point to the same filestructure that will exist
		[`packages/houdini/build/runtime-esm`]: mockFs.load(
			path.resolve(__dirname, 'packages', 'houdini', 'build', 'runtime-esm')
		),
		[`packages/houdini/build/runtime-cjs`]: mockFs.load(
			path.resolve(__dirname, 'packages', 'houdini', 'build', 'runtime-cjs')
		),
	})
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)
