import path from 'path'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import { getConfig, LogLevel } from '../common'
import { writeSchema } from './utils/writeSchema'
import generate from './generate'
import { ConfigFile } from '../runtime'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined, args: { pullHeader?: string[]; yes: boolean }) => {
	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// we need to collect some information from the user before we
	// can continue
	let { url, running } = await inquirer.prompt<{ url: string; running: boolean }>([
		{
			name: 'running',
			type: 'confirm',
			message: 'Is your GraphQL API running?',
		},
		{
			name: 'url',
			type: 'input',
			message: "What's the URL for your api? Please includes its scheme.",
			when: ({ running }) => running,
		},
	])

	if (!running) {
		console.log('❌ Your API must be running order to continue')
		return
	}

	// try to detect which tools they are using
	const { framework, typescript, module } = await detectTools(targetPath)

	// notify the users of what we detected
	console.log()
	console.log("👍 Here's what we found:")

	// framework
	if (framework === 'kit') {
		console.log('✨ SvelteKit')
	} else if (framework === 'sapper') {
		console.log('✨ Sapper')
	}

	// module
	if (module === 'esm') {
		console.log('📦 ES Modules')
	} else {
		console.log('📦 CommonJS')
	}

	// typescript
	if (typescript) {
		console.log('🟦 TypeScript')
	}

	if (framework === 'sapper') {
		console.log(
			'⚠️  Support for sapper will be dropped in the next minor version. If this is a problem, please start a discussion on GitHub.'
		)
	}

	console.log()
	console.log('🚧 Generating your project files...')

	// the location for the schema
	const schemaPath = './schema.graphql'

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.js')
	// where we put the houdiniClient
	const houdiniClientPath = typescript
		? path.join(sourceDir, 'client.ts')
		: path.join(sourceDir, 'client.js')

	await Promise.all(
		[
			// Get the schema from the url and write it to file
			writeSchema(url, path.join(targetPath, schemaPath), args?.pullHeader),

			// write the config file
			writeConfigFile({
				configPath,
				schemaPath,
				framework,
				module,
				url,
			}),

			// write the houdiniClient file
			fs.writeFile(houdiniClientPath, networkFile(url, typescript)),

			updatePackageJSON(targetPath),
		]

			// in kit, the $houdini alias is supported add the necessary stuff for the $houdini alias
			.concat(framework !== 'kit' ? [aliasPaths(targetPath)] : [])
			// only update the layout file if we're generating a kit or sapper project
			.concat(framework !== 'svelte' ? [updateLayoutFile(targetPath)] : [])
			// add the sveltekit config file
			.concat(framework === 'kit' ? [updateKitConfig(targetPath)] : [])
	)

	// make sure we don't log anything else
	const config = await getConfig({
		logLevel: LogLevel.Quiet,
	})
	await generate(config)

	// we're done!
	console.log()
	console.log('🎩 Welcome to Houdini!')
}

const networkFile = (url: string, typescript: boolean) => `
import { HoudiniClient${typescript ? ', type RequestHandlerArgs' : ''} } from '$houdini';

async function fetchQuery({
	fetch,
	text = '',
	variables = {},
	session,
	metadata
}${typescript ? ': RequestHandlerArgs' : ''}) {
	const url = import.meta.env.VITE_GRAPHQL_ENDPOINT || '${url}';
	const result = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			query: text,
			variables
		})
	});
	return await result.json();
}

export default new HoudiniClient(fetchQuery);
`

const writeConfigFile = async ({
	configPath,
	schemaPath,
	framework,
	module,
	url,
	sourceGlob = 'src/**/*.{svelte,gql,graphql}',
}: {
	configPath: string
	schemaPath: string
	framework: 'kit' | 'sapper' | 'svelte'
	module: 'esm' | 'commonjs'
	url: string
	sourceGlob?: string
}) => {
	const config: ConfigFile = {
		schemaPath,
		sourceGlob,
		apiUrl: url,
	}
	if (module !== 'esm') {
		config.module = module
	}
	if (framework !== 'kit') {
		config.framework = framework
	}

	// the actual config contents
	const configObj = JSON.stringify(config, null, 4)
	const content =
		module === 'esm'
			? // SvelteKit default config
			  `/** @type {import('houdini').ConfigFile} */
const config = ${configObj}

export default config
`
			: // sapper default config
			  `/** @type {import('houdini').ConfigFile} */
const config = ${configObj}

module.exports = config
`

	await fs.writeFile(configPath, content, 'utf-8')
}

type DetectedTools = {
	typescript: boolean
	framework: 'kit' | 'sapper' | 'svelte'
	module: 'esm' | 'commonjs'
}

async function detectTools(cwd: string): Promise<DetectedTools> {
	// if there's no package.json then there's nothing we can detect
	try {
		var packageJSON = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf-8'))
	} catch {
		throw new Error(
			'❌ houdini init must target an existing node project (with a package.json)'
		)
	}

	// grab the dev dependencies
	const { devDependencies, dependencies } = packageJSON

	const hasDependency = (dep: string) => Boolean(devDependencies?.[dep] || dependencies?.[dep])

	let framework: ConfigFile['framework'] = 'svelte'
	if (hasDependency('@sveltejs/kit')) {
		framework = 'kit'
	} else if (hasDependency('sapper')) {
		framework = 'sapper'
	}

	let typescript = false
	try {
		await fs.stat(path.join(cwd, 'tsconfig.json'))
		typescript = true
	} catch {}

	return {
		typescript,
		framework,
		module: packageJSON['type'] === 'module' ? 'esm' : 'commonjs',
	}
}

async function aliasPaths(targetPath: string) {
	// if there is no tsconfig.json, there could be a jsconfig.json
	let configFile = path.join(targetPath, 'tsconfig.json')
	try {
		await fs.stat(configFile)
	} catch {
		configFile = path.join(targetPath, 'jsconfig.json')
		try {
			await fs.stat(configFile)

			// there isn't either a .tsconfig.json or a jsconfig.json, there's nothing to update
		} catch {
			return
		}
	}

	// check if the tsconfig.json file exists
	try {
		var tsConfig = JSON.parse(await fs.readFile(configFile, 'utf-8'))

		tsConfig.compilerOptions.paths = {
			...tsConfig.compilerOptions.paths,
			$houdini: ['./$houdini/'],
		}

		await fs.writeFile(configFile, JSON.stringify(tsConfig, null, 4), 'utf-8')
	} catch {
		return
	}
}

async function updateLayoutFile(targetPath: string) {
	const layoutFile = path.join(targetPath, 'src', 'routes', '__layout.svelte')

	const contents = `<script context="module">
	import client from '../client'

	client.init()
</script>

<slot />

`

	// if the layout file doesn't exist, just tell the user to update it themselves
	try {
		await fs.stat(layoutFile)
		// if we get here, the file exists
		console.log(`⚠️  You already have a root layout file. Please update it to look like the following:
${contents}
`)
		return
	} catch {}

	// if we got this far we need to write the layout file
	await fs.writeFile(layoutFile, contents, 'utf-8')
}

async function updateKitConfig(targetPath: string) {
	const svelteConfigPath = path.join(targetPath, 'svelte.config.js')
	const viteConfigPath = path.join(targetPath, 'vite.config.js')

	const oldViteConfig = `import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()]
};

export default config;
`
	const viteConfig = `import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path'

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	server: {
		fs: {
			allow: ['.'],
		},
	},
};

export default config;
`
	const oldSvelteConfig1 = `import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter()
	}
};

export default config;
`
	const oldSvelteConfig2 = `import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
`

	const svelteConfig = `import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';
import houdini from 'houdini/preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [preprocess(), houdini()],

	kit: {
		adapter: adapter(),
		alias: {
			$houdini: './$houdini',
		}
	}
};

export default config;
`
	// look up the existing svelte config
	if (
		[oldSvelteConfig2, oldSvelteConfig1].includes(await fs.readFile(svelteConfigPath, 'utf-8'))
	) {
		await fs.writeFile(svelteConfigPath, svelteConfig, 'utf-8')
	} else {
		console.log(`⚠️  Could not update your svelte.config.js. Please update it to look like:

${svelteConfig}
`)
	}

	// look up the existing svelte config
	if ((await fs.readFile(viteConfigPath, 'utf-8')) === oldViteConfig) {
		await fs.writeFile(viteConfigPath, viteConfig, 'utf-8')
	} else {
		console.log(`⚠️  Could not update your vite.config.js. Please update it to look like:

${viteConfig}
`)
	}
}

async function updatePackageJSON(targetPath: string) {
	const packagePath = path.join(targetPath, 'package.json')

	var packageJSON = JSON.parse(await fs.readFile(packagePath, 'utf-8'))

	// add a generate script
	packageJSON.scripts = {
		...packageJSON.scripts,
		generate: 'houdini generate',
	}

	// and houdini should be a dev dependency
	packageJSON.devDependencies = {
		...packageJSON.devDependencies,
		houdini: '^HOUDINI_VERSION',
	}

	await fs.writeFile(packagePath, JSON.stringify(packageJSON, null, 4), 'utf-8')

	console.log(`✅ Added generate script to package.json`)
}
