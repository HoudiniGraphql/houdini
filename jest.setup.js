const recast = require('recast')
const graphql = require('graphql')
const { testConfig } = require('houdini-common')
const mockFs = require('mock-fs')
const path = require('path')

expect.addSnapshotSerializer({
	test: (val) => val && val.type,
	serialize: (val) => recast.print(val).code,
})

expect.addSnapshotSerializer({
	test: (val) => val && val.kind,
	serialize: (val) => graphql.print(val),
})

// the config to use in tests
const config = testConfig()

beforeEach(() => {
	mockFs({
		[path.relative(process.cwd(), config.rootDir)]: {
			[path.relative(config.rootDir, config.artifactDirectory)]: {},
			[path.relative(config.rootDir, config.runtimeDirectory)]: {},
		},
		// the runtime generator copies files relative to __dirname. we need our tests
		// to point to the same filestructure that
		[`packages/houdini/src/generators/runtime/template`]: mockFs.load(
			path.resolve(__dirname, 'packages/houdini/build/generators/runtime/template')
		),
	})
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)
