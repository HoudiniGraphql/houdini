const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const https = require('https')
const child_process = require('child_process')

// Adjust the version you want to install. You can also make this dynamic.
const BINARY_DISTRIBUTION_VERSION = 'package-version'

// Windows binaries end with .exe so we need to special case them.
const binaryName = process.platform === 'win32' ? 'my-binary.exe' : 'my-binary'

// Determine package name for this platform
const platformSpecificPackageName = `my-package-${process.platform}-${process.arch}`

// Compute the path we want to emit the fallback binary to
const fallbackBinaryPath = path.join(__dirname, binaryName)

// Manual binary path override support
const MANUAL_BINARY_PATH = process.env.HOUDINI_BINARY_PATH || process.env.MY_PACKAGE_BINARY_PATH

// Package version for validation
const packageJSON = require(path.join(__dirname, 'package.json'))
const expectedVersion = packageJSON.version

// Track if shim is still JavaScript
let isShimJS = true

function makeRequest(url) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (response) => {
				if (response.statusCode >= 200 && response.statusCode < 300) {
					const chunks = []
					response.on('data', (chunk) => chunks.push(chunk))
					response.on('end', () => {
						resolve(Buffer.concat(chunks))
					})
				} else if (
					response.statusCode >= 300 &&
					response.statusCode < 400 &&
					response.headers.location
				) {
					// Follow redirects
					makeRequest(response.headers.location).then(resolve, reject)
				} else {
					reject(
						new Error(
							`npm responded with status code ${response.statusCode} when downloading the package!`
						)
					)
				}
			})
			.on('error', (error) => {
				reject(error)
			})
	})
}

function extractFileFromTarball(tarballBuffer, filepath) {
	// Tar archives are organized in 512 byte blocks.
	// Blocks can either be header blocks or data blocks.
	// Header blocks contain file names of the archive in the first 100 bytes, terminated by a null byte.
	// The size of a file is contained in bytes 124-135 of a header block and in octal format.
	// The following blocks will be data blocks containing the file.
	let offset = 0
	while (offset < tarballBuffer.length) {
		const header = tarballBuffer.subarray(offset, offset + 512)
		offset += 512

		const fileName = header.toString('utf-8', 0, 100).replace(/\0.*/g, '')
		const fileSize = parseInt(header.toString('utf-8', 124, 136).replace(/\0.*/g, ''), 8)

		if (fileName === filepath) {
			return tarballBuffer.subarray(offset, offset + fileSize)
		}

		// Clamp offset to the uppoer multiple of 512
		offset = (offset + fileSize + 511) & ~511
	}
}

function installUsingNPM() {
	// Erase "npm_config_global" so that "npm install --global" works.
	// Otherwise this nested "npm install" will also be global, and the install
	// will deadlock waiting for the global installation lock.
	const env = { ...process.env, npm_config_global: undefined };

	// Create a temporary directory with an empty package.json
	const tempDir = path.join(__dirname, 'npm-install-temp');

	try {
		fs.mkdirSync(tempDir);
		fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

		// Run npm install in the temporary directory
		child_process.execSync(
			`npm install --loglevel=error --prefer-offline --no-audit --progress=false ${platformSpecificPackageName}@${BINARY_DISTRIBUTION_VERSION}`,
			{ cwd: tempDir, stdio: 'pipe', env }
		);

		// Move the downloaded binary to the fallback location
		const installedBinaryPath = path.join(tempDir, 'node_modules', platformSpecificPackageName, 'bin', binaryName);
		fs.renameSync(installedBinaryPath, fallbackBinaryPath);

		return true;
	} catch (err) {
		console.error(`[${packageJSON.name}] npm install fallback failed: ${err.message}`);
		return false;
	} finally {
		// Clean up temporary directory
		try {
			removeRecursive(tempDir);
		} catch {
			// Ignore cleanup errors
		}
	}
}

function removeRecursive(dir) {
	if (!fs.existsSync(dir)) return;

	for (const entry of fs.readdirSync(dir)) {
		const entryPath = path.join(dir, entry);
		const stats = fs.lstatSync(entryPath);

		if (stats.isDirectory()) {
			removeRecursive(entryPath);
		} else {
			fs.unlinkSync(entryPath);
		}
	}

	fs.rmdirSync(dir);
}

async function downloadBinaryFromNpm() {
	// First try nested npm install (like esbuild does)
	if (installUsingNPM()) {
		console.log(`[${packageJSON.name}] Downloaded binary via npm install`);
		return;
	}

	// Fallback to direct HTTP download
	console.log(`[${packageJSON.name}] Trying direct download from npm registry...`);

	// Download the tarball of the right binary distribution package
	const tarballDownloadBuffer = await makeRequest(
		`https://registry.npmjs.org/${platformSpecificPackageName}/-/${platformSpecificPackageName}-${BINARY_DISTRIBUTION_VERSION}.tgz`
	)

	const tarballBuffer = zlib.unzipSync(tarballDownloadBuffer)

	// Extract binary from package and write to disk
	fs.writeFileSync(
		fallbackBinaryPath,
		extractFileFromTarball(tarballBuffer, `package/bin/${binaryName}`),
		{ mode: 0o755 } // Make binary file executable
	)

	console.log(`[${packageJSON.name}] Downloaded binary via direct download`);
}

function isPlatformSpecificPackageInstalled() {
	try {
		// Try to resolve the platform package itself
		require.resolve(`${platformSpecificPackageName}/package.json`)
		return true
	} catch (e) {
		// Also check if it exists as a sibling directory
		const siblingPath = path.join(__dirname, '..', platformSpecificPackageName)
		const siblingBinaryPath = path.join(siblingPath, 'bin', binaryName)
		return fs.existsSync(siblingBinaryPath)
	}
}

if (!platformSpecificPackageName) {
	throw new Error('Platform not supported!')
}

// Replace the JavaScript shim with the actual binary for optimal performance (skip Node.js overhead)
// This is inspired by esbuild's approach: https://github.com/evanw/esbuild/blob/main/lib/npm/node-install.ts
function maybeOptimizePackage() {
	// Allow callers to opt out of the optimization (e.g. when building a snapshot
	// for an environment that can't run native binaries, like WebContainers).
	if (process.env.HOUDINI_SKIP_SHIM_INSTALL) {
		console.log(`[${packageJSON.name}] HOUDINI_SKIP_SHIM_INSTALL set, keeping JavaScript shim`)
		return
	}

	// This optimization doesn't work on Windows because the binary must be called with .exe extension
	// It also doesn't work with Yarn due to various compatibility issues
	if (process.platform === 'win32' || isYarn()) {
		return
	}

	let binaryPath = null

	try {
		// Method 1: Use require.resolve to find the platform-specific package
		const platformPackagePath = require.resolve(`${platformSpecificPackageName}/package.json`)
		const platformPackageDir = path.dirname(platformPackagePath)
		binaryPath = path.join(platformPackageDir, 'bin', binaryName)
	} catch (error) {
		// Method 2: Check if platform package is installed as a sibling directory
		const siblingPath = path.join(__dirname, '..', platformSpecificPackageName)
		binaryPath = path.join(siblingPath, 'bin', binaryName)

		if (!fs.existsSync(binaryPath)) {
			// Method 3: pnpm-specific structure
			const pnpmMatch = __dirname.match(/(.+\/node_modules\/)\.pnpm\/([^\/]+)\/node_modules\//)
			if (pnpmMatch) {
				const [, nodeModulesRoot] = pnpmMatch
				const pnpmDir = path.join(nodeModulesRoot, '.pnpm')

				try {
					const pnpmEntries = fs.readdirSync(pnpmDir)
					// Look for the specific version that matches BINARY_DISTRIBUTION_VERSION
					const expectedPnpmEntry = `${platformSpecificPackageName}@${BINARY_DISTRIBUTION_VERSION}`
					const platformEntry = pnpmEntries.find(entry => entry === expectedPnpmEntry)

					if (platformEntry) {
						binaryPath = path.join(pnpmDir, platformEntry, 'node_modules', platformSpecificPackageName, 'bin', binaryName)
					}
				} catch (err) {
					// Ignore errors
				}
			}
		}
	}

	// If we found the binary, try to replace the shim with it
	if (binaryPath && fs.existsSync(binaryPath)) {
		// First validate the binary works correctly
		if (!validateBinaryVersion(binaryPath)) {
			console.error(`[${packageJSON.name}] Binary validation failed, keeping JavaScript shim`);
			return;
		}

		const shimPath = path.join(__dirname, 'bin', packageJSON.name)
		const tempPath = path.join(__dirname, 'bin', `${packageJSON.name}-temp`)

		try {
			// First create a hard link to avoid taking up additional disk space
			fs.linkSync(binaryPath, tempPath)

			// Then atomically replace the shim with the binary
			fs.renameSync(tempPath, shimPath)

			// Make sure it's executable
			fs.chmodSync(shimPath, 0o755)

			// Update state tracking
			isShimJS = false

			console.log(`[${packageJSON.name}] Binary optimization successful`);
		} catch (err) {
			console.error(`[${packageJSON.name}] Binary optimization failed: ${err.message}`);
			// If optimization fails, clean up and continue with the shim
			try {
				fs.unlinkSync(tempPath)
			} catch {}
		}
	}
}

function validateBinaryVersion(binaryPath) {
	try {
		// For our Go binaries, we just check if they execute without crashing
		// We use -h flag which should work and exit cleanly
		child_process.execFileSync(binaryPath, ['-h'], {
			stdio: 'pipe',
			timeout: 5000,
			encoding: 'utf8'
		});
		return true;
	} catch (err) {
		// If the binary exits with code 0 or 2 (help), that's fine
		if (err.status === 0 || err.status === 2) {
			return true;
		}
		console.error(`[${packageJSON.name}] Binary validation failed: ${err.message}`);
		return false;
	}
}

function applyManualBinaryPathOverride(overridePath) {
	console.log(`[${packageJSON.name}] Using manual binary path: ${overridePath}`);

	const shimPath = path.join(__dirname, 'bin', packageJSON.name);
	const shimContent = `#!/usr/bin/env node
require('child_process').execFileSync(${JSON.stringify(overridePath)}, process.argv.slice(2), { stdio: 'inherit' });
`;

	try {
		fs.writeFileSync(shimPath, shimContent, { mode: 0o755 });
		isShimJS = true; // Keep as JS since it's a wrapper
		return true;
	} catch (err) {
		console.error(`[${packageJSON.name}] Failed to apply manual binary override: ${err.message}`);
		return false;
	}
}

function isYarn() {
	const { npm_config_user_agent } = process.env
	if (npm_config_user_agent) {
		return /\byarn\//.test(npm_config_user_agent)
	}
	return false
}

// Check for manual binary path override first
if (MANUAL_BINARY_PATH) {
	if (fs.existsSync(MANUAL_BINARY_PATH)) {
		console.log(`[${packageJSON.name}] Using manual binary path override`);
		if (applyManualBinaryPathOverride(MANUAL_BINARY_PATH)) {
			process.exit(0);
		}
	} else {
		console.warn(`[${packageJSON.name}] Ignoring invalid manual binary path: ${MANUAL_BINARY_PATH}`);
	}
}

// Skip downloading the binary if it was already installed via optionalDependencies
if (!isPlatformSpecificPackageInstalled()) {
	console.log(`[${packageJSON.name}] Platform package not found, downloading binary...`);
	downloadBinaryFromNpm().then(() => {
		maybeOptimizePackage();

		// Final validation
		const shimPath = path.join(__dirname, 'bin', packageJSON.name);
		if (isShimJS) {
			// Validate the JavaScript shim can find and run the binary
			if (!validateBinaryVersion(shimPath)) {
				console.error(`[${packageJSON.name}] Installation may be incomplete`);
			}
		}
	}).catch(err => {
		console.error(`[${packageJSON.name}] Failed to download binary: ${err.message}`);
		process.exit(1);
	});
} else {
	console.log(`[${packageJSON.name}] Platform package found, optimizing...`);
	maybeOptimizePackage();

	// Final validation
	const shimPath = path.join(__dirname, 'bin', packageJSON.name);
	if (isShimJS) {
		// Validate the JavaScript shim can find and run the binary
		if (!validateBinaryVersion(shimPath)) {
			console.error(`[${packageJSON.name}] Installation may be incomplete`);
		}
	} else {
		// Binary was optimized, validate it directly
		if (!validateBinaryVersion(shimPath)) {
			console.error(`[${packageJSON.name}] Binary optimization may have failed`);
		}
	}
}
