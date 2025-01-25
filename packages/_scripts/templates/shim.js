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

// With `getBinaryPath()` could access the binary in you JavaScript code as follows
module.exports.runBinary = function (...args) {
	require('child_process').execFileSync(getBinaryPath(), args, {
		stdio: 'inherit',
	})
}
