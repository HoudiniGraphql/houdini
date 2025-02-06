#!/usr/bin/env node

function getBinaryPath() {
	// lookup table for all platforms and binary distribution packages
	const BINARY_DISTRIBUTION_PACKAGES = {
		'linux-x64': 'my-package-linux-x64',
		'linux-arm64': 'my-package-linux-arm64',
		'win32-x64': 'my-package-windows-x64',
		'win32-arm64': 'my-package-windows-arm64',
		'darwin-x64': 'my-package-darwin-x64',
		'darwin-arm64': 'my-package-darwin-arm64',
	}

	// windows binaries end with .exe so we need to special case them
	const binaryName = process.platform === 'win32' ? 'my-binary.exe' : 'my-binary'

	// determine package name for this platform
	const platformSpecificPackageName =
		BINARY_DISTRIBUTION_PACKAGES[`${process.platform}-${process.arch}`]

	try {
		// resolving will fail if the optionalDependency was not installed
		return require.resolve(`../${platformSpecificPackageName}/bin/${binaryName}`)
	} catch (e) {
		return require('path').join(__dirname, binaryName)
	}
}
// instead of execFileSync, use spawn to handle the process more gracefully
const childProcess = require('child_process').spawn(getBinaryPath(), process.argv.slice(2), {
	stdio: 'inherit',
})

// array of signals we want to handle
const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT', 'SIGHUP']

// handle each signal
signals.forEach((signal) => {
	process.on(signal, () => {
		if (childProcess) {
			// on windows, we need to use taskkill for proper tree killing
			if (process.platform === 'win32') {
				require('child_process').spawn('taskkill', ['/pid', childProcess.pid, '/f', '/t'])
			} else {
				try {
					childProcess.kill(signal)
				} catch (err) {
					// if the process is already gone, that's fine
					if (err.code !== 'ESRCH') throw err
				}
			}
		}
		process.exit(0)
	})
})

// handle child process exit
childProcess.on('exit', (code, signal) => {
	// if the child was terminated due to a signal, exit with the same signal
	if (signal) {
		process.exit(0)
	} else {
		process.exit(code)
	}
})
