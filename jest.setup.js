const recast = require('recast')
const graphql = require('graphql')
const { testConfig } = require('houdini-common')
const mockFs = require('mock-fs')

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
		[config.rootDir]: {
			[config.artifactDirectory]: {},
			[config.patchDirectory]: {},
			[config.runtimeDirectory]: {},
		},
	})
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)
