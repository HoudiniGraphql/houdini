import fs from 'fs/promises'
import { getIntrospectionQuery } from 'graphql'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import path from 'path'
import { getConfig, LogLevel } from '../common'
import { ConfigFile } from '../runtime'
import generate from './generate'
import { readFile, writeFile } from './utils'
import { writeSchema } from './utils/writeSchema'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async function init(
	_path: string | undefined,
	args: { pullHeader?: string[]; yes: boolean },
	withRunningCheck = true
): Promise<void> {
	// if no path was given, we	'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// we need to collect some information from the user before we
	// can continue
	let { url, running } = await inquirer.prompt<{ url: string; running: boolean }>([
		{
			message: 'Is your GraphQL API running?',
			name: 'running',
			type: 'confirm',
			when: withRunningCheck,
		},
		{
			message: "What's the URL for your api?",
			name: 'url',
			type: 'input',
			default: 'http://localhost:3000/api/graphql',
			when: ({ running }) => !withRunningCheck || running,
		},
	])

	if (withRunningCheck && !running) {
		console.log('❌ Your API must be running order to continue')
		return
	}

	try {
		// verify we can send graphql queries to the server
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: getIntrospectionQuery(),
			}),
		})

		// if the response was not a 200, we have a problem
		if (response.status !== 200) {
			console.log('❌ That URL is not accepting GraphQL queries. Please try again.')
			return await init(_path, args, false)
		}
	} catch (e) {
		console.log('❌ Something went wrong: ' + (e as Error).message)
		return await init(_path, args, false)
	}

	// try to detect which tools they are using
	const { framework, typescript, module } = await detectTools(targetPath)

	// notify the users of what we detected
	console.log()
	console.log('🔎 Heres what we found:')

	// framework
	if (framework === 'kit') {
		console.log('✨ SvelteKit')
	} else if (framework === 'sapper') {
		console.log('✨ Sapper')
	} else {
		console.log('✨ Svelte')
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
	} else {
		console.log('🟨 JavaScript')
	}

	// put some space between discoveries and errors
	console.log()

	if (framework === 'sapper') {
		console.log(
			'⚠️  Support for sapper will be dropped in the next minor version. If this is a problem, please start a discussion on GitHub.'
		)
		console.log()
	}

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

	console.log('🚧 Generating project files...')

	await updatePackageJSON(targetPath)

	// generate the necessary files
	let headers = {}
	if ((args.pullHeader ?? []).length > 0) {
		headers = args.pullHeader!.reduce((total, header) => {
			const [key, value] = header.split('=')
			return {
				...total,
				[key]: value,
			}
		}, {})
	}
	await writeSchema(url, path.join(targetPath, schemaPath), headers)
	await writeConfigFile({
		targetPath,
		configPath,
		schemaPath,
		framework,
		module,
		url,
		typescript,
	})
	await writeFile(houdiniClientPath, networkFile(url, typescript))
	await graphqlRCFile(targetPath)
	await gitIgnore(targetPath)

	// in kit, the $houdini alias is supported add the necessary stuff for the $houdini alias
	if (framework !== 'kit') {
		await aliasPaths(targetPath)
		await updateSvelteConfig(targetPath)
	}
	// only update the layout file if we're generating a kit or sapper project
	if (framework !== 'svelte') {
		await updateLayoutFile(framework, targetPath, typescript)
	}
	// add the sveltekit config files
	if (framework === 'kit') {
		await updateKitConfig(targetPath)
	}

	// we're done!
	console.log()
	console.log('🎩 Welcome to Houdini!')
	console.log(`
👉 Next Steps
1️⃣  Finalize your installation: npm/yarn/pnpm install 
2️⃣  Start your application: npm run dev
`)
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
	targetPath,
	configPath,
	schemaPath,
	framework,
	module,
	url,
	sourceGlob = 'src/**/*.{svelte,gql,graphql}',
	typescript,
}: {
	targetPath: string
	configPath: string
	schemaPath: string
	framework: 'kit' | 'sapper' | 'svelte'
	module: 'esm' | 'commonjs'
	url: string
	sourceGlob?: string
	typescript: boolean
}): Promise<boolean> => {
	const config: ConfigFile = {
		schemaPath,
		sourceGlob,
		apiUrl: url,
	}
	if (typescript) {
		config.typescript = true
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

	await updateFile({
		projectPath: targetPath,
		filepath: configPath,
		content,
	})

	return false
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
			return false
		}
	}

	// check if the tsconfig.json file exists
	try {
		const tsConfigFile = await readFile(configFile)
		if (tsConfigFile) {
			var tsConfig = JSON.parse(tsConfigFile)
		}

		tsConfig.compilerOptions.paths = {
			...tsConfig.compilerOptions.paths,
			$houdini: ['./$houdini/'],
		}

		await writeFile(configFile, JSON.stringify(tsConfig, null, 4))
	} catch {}

	return false
}

async function updateLayoutFile(framework: 'kit' | 'sapper', targetPath: string, ts: boolean) {
	const filename = framework === 'sapper' ? '__layout.svelte' : '+layout.svelte'
	const layoutFile = path.join(targetPath, 'src', 'routes', filename)

	const content = `<script context="module" ${ts ? ' lang="ts"' : ''}>
	import client from '../client'

	client.init()
</script>

<slot />
`

	await updateFile({
		projectPath: targetPath,
		filepath: layoutFile,
		content,
	})
}

async function updateKitConfig(targetPath: string) {
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
import houdini from 'houdini/vite'

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		sveltekit(),
		houdini(),
	],
};

export default config;
`
	// write the vite config file
	await updateFile({
		projectPath: targetPath,
		filepath: viteConfigPath,
		content: viteConfig,
		old: [oldViteConfig],
	})
}

async function updateSvelteConfig(targetPath: string) {
	const svelteConfigPath = path.join(targetPath, 'svelte.config.js')
	const viteConfigPath = path.join(targetPath, 'vite.config.js')

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

	// write the svelte config file
	await updateFile({
		projectPath: targetPath,
		filepath: svelteConfigPath,
		content: svelteConfig,
		old: [oldSvelteConfig1, oldSvelteConfig2],
	})
}

async function updatePackageJSON(targetPath: string) {
	let packageJSON: Record<string, any> = {}

	const packagePath = path.join(targetPath, 'package.json')
	const packageFile = await readFile(packagePath)
	if (packageFile) {
		packageJSON = JSON.parse(packageFile)
	}

	// and houdini should be a dev dependency
	packageJSON.devDependencies = {
		...packageJSON.devDependencies,
		houdini: '^HOUDINI_VERSION',
	}

	await writeFile(packagePath, JSON.stringify(packageJSON, null, 4))
}

async function graphqlRCFile(targetPath: string) {
	// the filepath for the rcfile
	const target = path.join(targetPath, '.graphqlrc.yaml')

	const content = `projects:
  default:
    schema:
      - ./schema.graphql
      - ./$houdini/graphql/schema.graphql
    documents:
      - '**/*.gql'
      - ./$houdini/graphql/documents.gql
`

	await updateFile({
		projectPath: targetPath,
		filepath: target,
		content,
	})
}

async function gitIgnore(targetPath: string) {
	const filepath = path.join(targetPath, '.gitignore')
	const existing = (await readFile(filepath)) || ''
	await writeFile(filepath, existing + '\n$houdini\n')
}

type DetectedTools = {
	typescript: boolean
	framework: 'kit' | 'sapper' | 'svelte'
	module: 'esm' | 'commonjs'
}

async function detectTools(cwd: string): Promise<DetectedTools> {
	// if there's no package.json then there's nothing we can detect
	try {
		const packageJSONFile = await readFile(path.join(cwd, 'package.json'))
		if (packageJSONFile) {
			var packageJSON = JSON.parse(packageJSONFile)
		}
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

async function updateFile({
	projectPath,
	filepath,
	old = [],
	content,
}: {
	projectPath: string
	filepath: string
	old?: string[]
	content: string
}) {
	// look up the file contents
	const existingContents = await readFile(filepath)

	// compare the existing contents to the approved overwrite list
	if (existingContents && !old.includes(existingContents)) {
		// show the filepath relative to the project path
		const relPath = path.relative(projectPath, filepath)

		// show a message before we prompt their response
		console.log()
		console.log(`⚠️  ${relPath} already exists. We'd like to replace it with:
	
${content}`)

		// ask the user if we should continue
		const { done } = await inquirer.prompt<{ done: boolean }>([
			{
				name: 'done',
				type: 'confirm',
				message: 'Should we overwrite the file? If not, please update it manually.',
			},
		])

		if (!done) {
			return
		}
	}

	// if we got this far we are safe to write the file
	await writeFile(filepath, content)
}
