import { fs, path } from '.'

export type HoudiniFrameworkInfo =
	| {
			framework: 'kit'
	  }
	| {
			framework: 'svelte'
	  }

type DetectedFromPackageTools = {
	module: 'esm' | 'commonjs'
	frameworkInfo: HoudiniFrameworkInfo
}

export type DetectedTools = {
	typescript: boolean
	package_manager: 'npm' | 'yarn' | 'pnpm'
} & DetectedFromPackageTools

export async function detectFromPackageJSON(cwd: string): Promise<DetectedFromPackageTools> {
	// if there's no package.json then there's nothing we can detect
	try {
		const packageJSONFile = await fs.readFile(path.join(cwd, 'package.json'))
		if (packageJSONFile) {
			var packageJSON = JSON.parse(packageJSONFile)
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

export async function detectTools(cwd: string = process.cwd()): Promise<DetectedTools> {
	let typescript = false
	try {
		await fs.stat(path.join(cwd, 'tsconfig.json'))
		typescript = true
	} catch {}

	// package manager?
	let package_manager: 'npm' | 'yarn' | 'pnpm' = 'npm'
	let dir = cwd
	do {
		if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) {
			package_manager = 'pnpm'
			break
		}
		if (fs.existsSync(path.join(dir, 'yarn.lock'))) {
			package_manager = 'yarn'
			break
		}
	} while (dir !== (dir = path.dirname(dir)))

	return {
		typescript,
		package_manager,
		...(await detectFromPackageJSON(cwd)),
	}
}
