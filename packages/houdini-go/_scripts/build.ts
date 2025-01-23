import { join as joinPath } from 'jsr:@std/path'
import parentPkg from "../package.json" with { type: "json" }

const PACKAGE_NAME = parentPkg.name
const BUILD_DIR = 'build'

// Major platforms on arm64 and amd64, more can be added later
const platforms = [
	{ GOOS: 'darwin', GOARCH: 'amd64', NODEOS: 'darwin', NODECPU: 'x64' },
	{ GOOS: 'darwin', GOARCH: 'arm64', NODEOS: 'darwin', NODECPU: 'arm64' },
	{ GOOS: 'linux', GOARCH: 'amd64', NODEOS: 'linux', NODECPU: 'x64' },
	{ GOOS: 'linux', GOARCH: 'arm64', NODEOS: 'linux', NODECPU: 'arm64' },
	{ GOOS: 'windows', GOARCH: 'amd64', NODEOS: 'win32', NODECPU: 'x64' },
	{ GOOS: 'windows', GOARCH: 'arm64', NODEOS: 'win32', NODECPU: 'arm64' },
] as const


platforms.forEach(async ({ GOOS, GOARCH, NODEOS, NODECPU }) => {
	const pkg_name = `${PACKAGE_NAME}-${NODEOS}-${NODECPU}`
	const pkg_dir = joinPath(BUILD_DIR, pkg_name, 'bin')
	Deno.mkdirSync(pkg_dir, { recursive: true })

	console.log(`Building ${pkg_name}...`)

	// Build the go binary for the current platform
	const command = new Deno.Command('go', {
		args: [
			'build',
			'-o',
			joinPath(pkg_dir, `${PACKAGE_NAME}${GOOS === 'windows' ? '.exe' : ''}`),
			'.',
		],
		env: {
			GOOS,
			GOARCH,
		},
		stdin: 'null',
		stdout: 'piped',
	})

	const child = command.spawn()
	const status = await child.status

	if (!status.success) {
		console.error(`Error building for ${GOOS}/${GOARCH}`)
		return
	}

	// Create package.json
	const pkg = {
		name: pkg_name,
		version: parentPkg.version,
		authors: parentPkg.authors,
		description: parentPkg.description,
		os: [NODEOS],
		cpu: [NODECPU],
	}

	const encoder = new TextEncoder()
	const data = encoder.encode(JSON.stringify(pkg, null, 2))
	const pkg_json_path = joinPath(pkg_dir, 'package.json')
	await Deno.writeFile(pkg_json_path, data)
})

console.log('Building meta-package...')

const meta_pkg_dir = joinPath(BUILD_DIR, PACKAGE_NAME)

// Create the meta-package
Deno.mkdirSync(meta_pkg_dir, { recursive: true })

const meta_pkg = {
	name: PACKAGE_NAME,
	version: parentPkg.version,
	authors: parentPkg.authors,
	description: parentPkg.description,
	optionalDependencies: {} as Record<string, string>,
}

for (const { NODEOS, NODECPU } of platforms) {
	const pkg_name = `${PACKAGE_NAME}-${NODEOS}-${NODECPU}`
	const version = parentPkg.version

	meta_pkg.optionalDependencies[pkg_name] = version
}

const encoder = new TextEncoder()
const data = encoder.encode(JSON.stringify(meta_pkg, null, 2))
const meta_pkg_json_path = joinPath(meta_pkg_dir, 'package.json')
await Deno.writeFile(meta_pkg_json_path, data)