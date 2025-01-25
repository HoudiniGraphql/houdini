import childProcess from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

// if a package needs to be published as a go script then we need to :
// - compile the project for every supported os and architecture into a separate directory
// - generate the appropriate package.json file for each os/architecture
//   - the bin field should point to the compiled binary
// - the root package needs an install script that ensures the correct binary is installed for the current os/architecture
// - the package itself could _also_ be a node package (identified by the package directory) in which case the package entry
//   points need to be set up correctly

// Major platforms on arm64 and amd64, more can be added later
const platforms = [
	{ goOS: 'darwin', arch: 'amd64', nodeOS: 'darwin', cpu: 'x64' },
	{ goOS: 'darwin', arch: 'arm64', nodeOS: 'darwin', cpu: 'arm64' },
	{ goOS: 'linux', arch: 'amd64', nodeOS: 'linux', cpu: 'x64' },
	{ goOS: 'linux', arch: 'arm64', nodeOS: 'linux', cpu: 'arm64' },
	{ goOS: 'windows', arch: 'amd64', nodeOS: 'win32', cpu: 'x64' },
	{ goOS: 'windows', arch: 'arm64', nodeOS: 'win32', cpu: 'arm64' },
]

async function execCmd(cmd, args, env) {
	const spawn = childProcess.spawn(cmd, args, {
		env: { ...process.env, ...env },
	})

	spawn.stdout.on('data', (data) => console.log(data.toString()))
	spawn.stderr.on('data', (data) => console.error(data.toString()))

	return new Promise((resolve, reject) => {
		spawn.on('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`Build failed with code ${code}`))
		)
	})
}

function buildGoModule(goOS, goArch, outputPath, moduleName) {
	return execCmd(
		'go',
		['build', '-o', `${outputPath}/${moduleName}${goOS === 'windows' ? '.exe' : ''}`],
		{
			GOOS: goOS,
			GOARCH: goArch,
		}
	)
}

export default async function () {
	const cwd = process.cwd()
	const buildDir = path.join(cwd, 'build')

	try {
		await fs.rm(buildDir, { recursive: true })
	} catch (e) {}

	// load the current package.json to grab necessary metadata
	const packageJSON = (
		await import(path.join(cwd, 'package.json'), {
			assert: { type: 'json' },
		})
	).default

	// build each platform
	await Promise.all(
		platforms.map(async (platform) => {
			// the module name is a combination of the current package name and the platform
			const moduleName = `${packageJSON.name}-${platform.goOS}-${platform.arch}`

			// put each binary in its own directory
			const outputDir = path.join(buildDir, moduleName)

			// the path to the binary
			const bin = `bin/${packageJSON.name}${platform.goOS === 'windows' ? '.exe' : ''}`

			// compile the go module
			await buildGoModule(
				platform.goOS,
				platform.arch,
				path.join(outputDir, 'bin'),
				packageJSON.name
			)

			// make sure the binary is executable
			await execCmd('chmod', ['+x', path.join(outputDir, bin)], {})

			// next we need to add the package.json file
			await fs.writeFile(
				path.join(outputDir, 'package.json'),
				JSON.stringify(
					{
						name: `@houdinigraphql/${moduleName}`,
						version: packageJSON.version,
						bin,
						os: [platform.nodeOS],
						cpu: [platform.cpu],
					},
					null,
					4
				)
			)
		})
	)

	// now we need to create the root package
	await fs.mkdir(path.join(buildDir, packageJSON.name))

	// add an optional dependency for every platform
	packageJSON.optionalDependencies = Object.fromEntries(
		platforms.map((platform) => [
			`@houdinigraphql/${packageJSON.name}-${platform.goOS}-${platform.arch}`,
			packageJSON.version,
		])
	)
	// make sure the postinstall script is wired up
	packageJSON.scripts = {
		...packageJSON.scripts,
		postinstall: 'node install.js',
	}

	await fs.writeFile(
		path.join(buildDir, packageJSON.name, 'package.json'),
		JSON.stringify(packageJSON, null, 4)
	)

	// read the install script
	let installScript = await fs.readFile(
		path.join(path.dirname(new URL(import.meta.url).pathname), './postInstall.js'),
		'utf8'
	)
	// apply the package specifics to the install script template
	installScript = installScript
		.replace(/my-package/g, packageJSON.name)
		.replace(/my-binary/g, packageJSON.name)
		.replace(/package-version/g, packageJSON.version)

	await fs.writeFile(path.join(buildDir, packageJSON.name, 'install.js'), installScript, 'utf8')
}
