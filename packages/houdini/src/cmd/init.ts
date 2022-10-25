import { getIntrospectionQuery } from 'graphql'
import fetch from 'node-fetch'
import prompts from 'prompts'

import { fs, parseJSON, path, pullSchema } from '../lib'
import { ConfigFile } from '../runtime/lib/config'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async function init(
	_path: string | undefined,
	args: { headers?: string[]; yes: boolean },
	withRunningCheck = true
): Promise<void> {
	// before we start anything, let's make sure they have initialized their project
	try {
		await fs.stat(path.resolve('./src'))
	} catch {
		throw new Error(
			'Please initialize your project first before running init. For svelte projects, you should follow the instructions here: https://kit.svelte.dev/'
		)
	}

	let headers = {}
	if ((args.headers ?? []).length > 0) {
		headers = args.headers!.reduce((total, header) => {
			const [key, value] = header.split('=')
			return {
				...total,
				[key]: value,
			}
		}, {})
	}

	// if no path was given, we	'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// make sure its running
	let running = true
	if (withRunningCheck) {
		running = (
			await prompts({
				message: 'Is your GraphQL API running?',
				name: 'running',
				type: 'confirm',
				initial: true,
			})
		).running
	}
	if (!running) {
		console.log('❌ Your API must be running order to continue')
		return
	}

	let { url } = await prompts(
		{
			message: "What's the URL for your api?",
			name: 'url',
			type: 'text',
			initial: 'http://localhost:4000/graphql',
		},
		{
			onCancel() {
				process.exit(1)
			},
		}
	)

	try {
		// verify we can send graphql queries to the server
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...headers,
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

		// make sure we can parse the response as json
		await response.json()
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
			'❌  Sorry, Houdini no longer supports Sapper. Please downgrade to v0.15.x or migrate to SvelteKit.'
		)
		process.exit(1)
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
	// houdini client import path
	const houdiniClientImport = './src/client'

	console.log('🚧 Generating project files...')

	await updatePackageJSON(targetPath)

	await pullSchema(url, path.join(targetPath, schemaPath), headers)
	await writeConfigFile({
		targetPath,
		configPath,
		schemaPath,
		framework,
		module,
		url,
		houdiniClientImport,
	})
	await fs.writeFile(houdiniClientPath, networkFile(url, typescript))
	await graphqlRCFile(targetPath)
	await gitIgnore(targetPath)

	// Config files for:
	// - kit only
	// - svelte only
	// - both (with small variants)
	if (framework === 'kit') {
		await updateSvelteConfig(targetPath)
	} else if (framework === 'svelte') {
		await updateSvelteMainJs(targetPath)
	}
	await updateViteConfig(targetPath, framework, typescript)
	await tjsConfig(targetPath, framework)

	// we're done!
	console.log()
	console.log('🎩 Welcome to Houdini!')
	console.log(`
👉 Next Steps
1️⃣  Finalize your installation: npm/yarn/pnpm install
2️⃣  Start your application: npm run dev
`)
}

const networkFile = (url: string, typescript: boolean) => `import { HoudiniClient${
	typescript ? ', type RequestHandlerArgs' : ''
} } from '$houdini';

async function fetchQuery({
	fetch,
	text = '',
	variables = {},
	metadata
}${typescript ? ': RequestHandlerArgs' : ''}) {
	const url = '${url}';
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
	houdiniClientImport,
}: {
	targetPath: string
	configPath: string
	schemaPath: string
	framework: 'kit' | 'svelte'
	module: 'esm' | 'commonjs'
	url: string
	houdiniClientImport: string
}): Promise<boolean> => {
	const config: ConfigFile = {
		apiUrl: url,
	}

	// if it's different for defaults, write it down
	if (schemaPath !== './schema.graphql') {
		config.schemaPath = schemaPath
	}
	if (module !== 'esm') {
		config.module = module
	}

	// put plugins at the bottom
	config.plugins = {
		'houdini-svelte': {
			client: houdiniClientImport,
		},
	}

	// the actual config contents
	const configObj = JSON.stringify(config, null, 4)
	const content =
		module === 'esm'
			? // ESM default config
			  `/** @type {import('houdini').ConfigFile} */
const config = ${configObj}

export default config
`
			: // CommonJS default config
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

async function tjsConfig(targetPath: string, framework: 'kit' | 'svelte') {
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
		let tjsConfigFile = await fs.readFile(configFile)
		if (tjsConfigFile) {
			var tjsConfig = parseJSON(tjsConfigFile)
		}

		// new rootDirs (will overwrite the one in "extends": "./.svelte-kit/tsconfig.json")
		if (framework === 'kit') {
			tjsConfig.compilerOptions.rootDirs = ['.', './.svelte-kit/types', './$houdini/types']
		} else {
			tjsConfig.compilerOptions.rootDirs = ['.', './$houdini/types']
		}

		// In kit, no need to add manually the path. Why? Because:
		//   The config [svelte.config.js => kit => alias => $houdini]
		//   will make this automatically in "extends": "./.svelte-kit/tsconfig.json"
		// In svelte, we need to add the path manually
		if (framework === 'svelte') {
			tjsConfig.compilerOptions.paths = {
				...tjsConfig.compilerOptions.paths,
				$houdini: ['./$houdini/'],
			}
		}

		await fs.writeFile(configFile, JSON.stringify(tjsConfig, null, 4))
	} catch {}

	return false
}

async function updateViteConfig(
	targetPath: string,
	framework: 'kit' | 'svelte',
	typescript: boolean
) {
	const viteConfigPath = path.join(targetPath, `vite.config${typescript ? '.ts' : '.js'}`)

	const oldViteConfig1 = `import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()]
};

export default config;
`

	const oldViteConfig2 = `import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
	plugins: [sveltekit()]
};

export default config;
`

	const viteConfigKit = `import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [houdini(), sveltekit()],
}

export default config;
`

	const viteConfigKitTs = `import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';
import type { UserConfig } from "vite";

const config: UserConfig = {
	plugins: [houdini(), sveltekit()],
}

export default config;
`

	const viteConfigSvelte = `import { svelte } from '@sveltejs/vite-plugin-svelte';
import houdini from 'houdini/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [houdini(), svelte()],
}

export default config;
`

	const viteConfigSvelteTs = `import { svelte } from '@sveltejs/vite-plugin-svelte';
import houdini from 'houdini/vite';
import type { UserConfig } from "vite";

const config: UserConfig = {
	plugins: [houdini(), svelte()],
}

export default config;
`

	let content = 'NOTHING!'
	if (framework === 'kit' && typescript) {
		content = viteConfigKitTs
	} else if (framework === 'kit' && !typescript) {
		content = viteConfigKit
	} else if (framework === 'svelte' && typescript) {
		content = viteConfigSvelteTs
	} else if (framework === 'svelte' && !typescript) {
		content = viteConfigSvelte
	} else {
		throw new Error('Unknown updateViteConfig()')
	}

	if (typescript) {
		await updateFile({
			projectPath: targetPath,
			filepath: viteConfigPath,
			content: framework === 'kit' ? viteConfigKitTs : viteConfigSvelteTs,
			old: [oldViteConfig1, oldViteConfig2],
		})
	} else {
		await updateFile({
			projectPath: targetPath,
			filepath: viteConfigPath,
			content: framework === 'kit' ? viteConfigKit : viteConfigSvelte,
			old: [oldViteConfig1, oldViteConfig2],
		})
	}
}

async function updateSvelteConfig(targetPath: string) {
	const svelteConfigPath = path.join(targetPath, 'svelte.config.js')

	const newContent = `import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			$houdini: './$houdini',
		}
	}
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

	// write the svelte config file
	await updateFile({
		projectPath: targetPath,
		filepath: svelteConfigPath,
		content: newContent,
		old: [oldSvelteConfig1, oldSvelteConfig2],
	})
}

async function updateSvelteMainJs(targetPath: string) {
	const svelteMainJsPath = path.join(targetPath, 'main.js')

	const newContent = `import client from "../client";
import './app.css'
import App from './App.svelte'

client.init();

const app = new App({
	target: document.getElementById('app')
})

export default app
`

	const oldContent = `import './app.css'
import App from './App.svelte'

const app = new App({
	target: document.getElementById('app')
})

export default app
`

	await updateFile({
		projectPath: targetPath,
		filepath: svelteMainJsPath,
		content: newContent,
		old: [oldContent],
	})
}

async function updatePackageJSON(targetPath: string) {
	let packageJSON: Record<string, any> = {}

	const packagePath = path.join(targetPath, 'package.json')
	const packageFile = await fs.readFile(packagePath)
	if (packageFile) {
		packageJSON = JSON.parse(packageFile)
	}

	// houdini & graphql should be a dev dependencies
	packageJSON.devDependencies = {
		...packageJSON.devDependencies,
		houdini: '^PACKAGE_VERSION',
		'houdini-svelte': '^PACKAGE_VERSION',
		graphql: '^15.5.0',
	}

	await fs.writeFile(packagePath, JSON.stringify(packageJSON, null, 4))
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
	const existing = (await fs.readFile(filepath)) || ''
	await fs.writeFile(filepath, existing + '\n$houdini\n')
}

type DetectedTools = {
	typescript: boolean
	framework: 'kit' | 'sapper' | 'svelte'
	module: 'esm' | 'commonjs'
}

async function detectTools(cwd: string): Promise<DetectedTools> {
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

	let framework: ConfigFile['framework'] = 'svelte'
	if (hasDependency('@sveltejs/kit')) {
		framework = 'kit'
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
	const existingContents = await fs.readFile(filepath)

	// compare the existing contents to the approved overwrite list
	if (existingContents && !old.includes(existingContents)) {
		// show the filepath relative to the project path
		const relPath = path.relative(projectPath, filepath)

		// show a message before we prompt their response
		console.log()
		console.log(`⚠️  ${relPath} already exists. We'd like to replace it with:

${content}`)

		// ask the user if we should continue
		const { done } = await prompts(
			{
				name: 'done',
				type: 'confirm',
				message: 'Should we overwrite the file? If not, please update it manually.',
			},
			{
				onCancel() {
					process.exit(1)
				},
			}
		)

		if (!done) {
			return
		}
	}

	// if we got this far we are safe to write the file
	await fs.writeFile(filepath, content)
}
