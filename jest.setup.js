const recast = require('recast')

expect.addSnapshotSerializer({
	test: (val) => val.type,
	serialize: (val) => recast.print(val).code,
})
