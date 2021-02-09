const recast = require('recast')
const { testConfig } = require('houdini-common')
const mockFs = require('mock-fs')

expect.addSnapshotSerializer({
	test: (val) => val.type,
	serialize: (val) => recast.print(val).code,
})

// the config to use in tests
const config = testConfig()

beforeEach(() => {
	mockFs({
		[config.runtimeDirectory]: {
			[config.artifactDirectory]: {},
			[config.patchDirectory]: {},
		},
	})
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)
