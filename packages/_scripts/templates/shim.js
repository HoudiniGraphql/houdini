#!/usr/bin/env node

function getBinaryPath() {
	// Lookup table for all platforms and binary distribution packages
	const BINARY_DISTRIBUTION_PACKAGES = {
		'linux-x64': 'my-package-linux-x64',
		'linux-arm': 'my-package-linux-arm',
		'win32-x64': 'my-package-windows-x64',
	}

	// Windows binaries end with .exe so we need to special case them.
	const binaryName = process.platform === 'win32' ? 'my-binary.exe' : 'my-binary'

	// Determine package name for this platform
	const platformSpecificPackageName =
		BINARY_DISTRIBUTION_PACKAGES[`${process.platform}-${process.arch}`]

	try {
		// Resolving will fail if the optionalDependency was not installed
		return require.resolve(`${platformSpecificPackageName}/bin/${binaryName}`)
	} catch (e) {
		return require('path').join(__dirname, '..', binaryName)
	}
}

// this command needs to kick off the binary and pass the command line arguments through
require('child_process').execFileSync(process.argv.slice(2), args, {
	stdio: 'inherit',
})
