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
	const paths = {
		[path.relative(process.cwd(), config.rootDir)]: {
			[path.relative(config.rootDir, config.artifactDirectory)]: {},
			[path.relative(config.rootDir, config.patchDirectory)]: {},
			[path.relative(config.rootDir, config.runtimeDirectory)]: {},
		},
		[`src/generators/runtime/template`]: {}
	}
	mockFs(paths)
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)
