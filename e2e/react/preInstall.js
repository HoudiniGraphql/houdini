import fs from 'fs/promises'

// we need to set up the packages for the e2e tests. since they are generated
// we need to copy them from the various build directories and put them in our node_modules
// get the list of directories in the build directory

for (const pkg of ['houdini-core', 'houdini-react']) {
	// make sure the node_modules directory exists
	try {
		await fs.mkdir('node_modules')
	} catch (e) {
		// ignore
	}

	// each package needs 2 packages to be coped over: the platform-generic package
	// and the platform-specific ones
	const suffix =
		{ linux: 'linux', win32: 'windows', darwin: 'darwin' }[process.platform] +
		`-${process.arch}`

	for (const target of [pkg, `${pkg}-${suffix}`]) {
		try {
			await fs.symlink(
				`../../../packages/${pkg}/build/${target}`,
				`node_modules/${target}`,
				'dir'
			)
		} catch (e) {
			// ignore
		}
	}
}
