import type { Adapter } from 'houdini'
import { resolve } from 'import-meta-resolve'
import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const adapters = [
	{
		name: 'CloudFlare Pages',
		test: () => Boolean(process.env.CF_PAGES),
		module: 'houdini-adapter-cloudflare',
	},
	{
		name: 'HoudiniCloud',
		test: () => Boolean(process.env.HOUDINI_CLOUD),
		module: 'houdini-cloud-adapter',
	},
	// putting this at the bottom makes it will be the default
	{
		name: 'Node',
		test: () => true,
		module: 'houdini-adapter-node',
	},
]

const adapter: Adapter = async (ctx) => {
	// find the matching adapter
	let match: (typeof adapters)[number] | undefined
	for (const adapter of adapters) {
		if (adapter.test()) {
			match = adapter
			break
		}
	}

	// make typescript happy even tho we have a default
	if (!match) throw new Error('Could not identify environment')

	// tell the user what we found
	console.log(`🎩 Identified environment: ${match.name}`)

	// load the adapter
	const nextAdapter = await loadAdapter(match)

	// run the adapter
	return nextAdapter(ctx)
}

async function loadAdapter({ module }: { module: string }): Promise<Adapter> {
	// if we have the required module loaded, we're good
	try {
		return (await importFromCwd(module)) as Adapter
	} catch (err) {
		// if the error indicates we were missing the module, let's keep going
		const error = err as Error & { code: string }
		if (
			error.code !== 'ERR_MODULE_NOT_FOUND' ||
			!error.message.startsWith(`Cannot find package '${module}'`)
		) {
			throw err
		}
	}

	// if we didn't have the module loaded we can try installing it with the users package manager
	const { package_manager } = await detectTools()

	// the command to run to install the adapter
	const installCmds = {
		yarn: 'add -D',
		npm: 'install -D',
		pnpm: 'add -D',
	}

	// something might go wrong during installation
	try {
		// install the pacakge we need to
		execSync(`${package_manager} ${installCmds[package_manager]} ${module}`, {
			stdio: 'inherit',
			env: {
				...process.env,
				NODE_ENV: undefined,
			},
		})

		console.log(`Successfully installed ${module}!`)
		console.warn(
			`If you plan on staying in this environment, consider adding ${module} to your project so you don't have to install it every time you build your application.`
		)

		// we should be able to import it now
		return (await importFromCwd(module)) as Adapter
	} catch (err) {
		throw new Error(
			`Could not install package ${module}. Please install it manually or maybe consider replacing houdini-adapter-auto with ${module}.` +
				`\n${(err as Error).message}`
		)
	}
}

async function importFromCwd(name: string) {
	const cwd = pathToFileURL(process.cwd()).href
	const url = resolve(name, cwd + '/x.js')

	return (await import(url)).default
}

async function detectTools(cwd: string = process.cwd()): Promise<DetectedTools> {
	let typescript = false
	try {
		await fs.stat(path.join(cwd, 'tsconfig.json'))
		typescript = true
	} catch {}

	// package manager?
	let package_manager: 'npm' | 'yarn' | 'pnpm' = 'npm'
	let dir = cwd
	do {
		try {
			await fs.access(path.join(dir, 'pnpm-lock.yaml'))
			package_manager = 'pnpm'
			break
		} catch {}

		try {
			await fs.access(path.join(dir, 'yarn.lock'))
			package_manager = 'yarn'
			break
		} catch {}
	} while (dir !== (dir = path.dirname(dir)))

	return {
		typescript,
		package_manager,
		...(await detectFromPackageJSON(cwd)),
	}
}

type HoudiniFrameworkInfo =
	| {
			framework: 'kit'
	  }
	| {
			framework: 'svelte'
	  }

type DetectedTools = {
	typescript: boolean
	package_manager: 'npm' | 'yarn' | 'pnpm'
} & DetectedFromPackageTools

async function detectFromPackageJSON(cwd: string): Promise<DetectedFromPackageTools> {
	// if there's no package.json then there's nothing we can detect
	let packageJSON: Record<string, any>
	try {
		const packageJSONFile = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8')
		if (packageJSONFile) {
			packageJSON = JSON.parse(packageJSONFile)
		} else {
			throw new Error('not found')
		}
	} catch {
		throw new Error(
			'❌ houdini init must target an existing node project (with a package.json)'
		)
	}

	// grab the dev dependencies
	const { devDependencies, dependencies } = packageJSON

	const hasDependency = (dep: string) => Boolean(devDependencies?.[dep] || dependencies?.[dep])

	let frameworkInfo: HoudiniFrameworkInfo = { framework: 'svelte' }
	if (hasDependency('@sveltejs/kit')) {
		frameworkInfo = { framework: 'kit' }
	}

	return {
		frameworkInfo,
		module: packageJSON['type'] === 'module' ? 'esm' : 'commonjs',
	}
}

type DetectedFromPackageTools = {
	module: 'esm' | 'commonjs'
	frameworkInfo: HoudiniFrameworkInfo
}

export default adapter
