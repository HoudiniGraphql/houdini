import { logGreen } from '@kitql/helper'
import { execSync } from 'child_process'
import { getIntrospectionQuery } from 'graphql'
import fetch from 'node-fetch'
import prompts from 'prompts'

import { fs, parseJSON, path, pullSchema } from '../lib'
import { ConfigFile } from '../runtime/lib/config'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async function init(
	_path: string | undefined,
	args: { headers?: string[]; force_remote_endpoint?: boolean }
): Promise<void> {
	const force_remote_endpoint = args.force_remote_endpoint || false

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

	// git check
	if (!force_remote_endpoint) {
		// from https://github.com/sveltejs/kit/blob/master/packages/migrate/migrations/routes/index.js#L60
		let use_git = false

		let dir = targetPath
		do {
			if (fs.existsSync(path.join(dir, '.git'))) {
				use_git = true
				break
			}
		} while (dir !== (dir = path.dirname(dir)))

		if (use_git) {
			const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString()

			if (status) {
				const message =
					'Your git working directory is dirty — we recommend committing your changes before running this migration.\n'
				console.error(message)

				const { confirm } = await prompts({
					message: 'Continue anyway?',
					name: 'confirm',
					type: 'confirm',
					initial: false,
				})

				if (!confirm) {
					process.exit(1)
				}
			}
		}
	}

	// Questions...
	let url = 'http://localhost:5173/api/graphql'
	const { is_remote_endpoint } = force_remote_endpoint
		? { is_remote_endpoint: true }
		: await prompts(
				{
					message: 'Will you use a remote GraphQL API?',
					name: 'is_remote_endpoint',
					type: 'confirm',
					initial: true,
				},
				{
					onCancel() {
						process.exit(1)
					},
				}
		  )

	let schemaPath = is_remote_endpoint ? './schema.graphql' : 'path/to/src/lib/**/*.graphql'

	if (is_remote_endpoint) {
		const { url_remote } = await prompts(
			{
				message: "What's the URL for your api?",
				name: 'url_remote',
				type: 'text',
				initial: 'http://localhost:4000/graphql',
			},
			{
				onCancel() {
					process.exit(1)
				},
			}
		)

		// set the url for later
		url = url_remote
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
				return await init(_path, { ...args, force_remote_endpoint: true })
			}

			// make sure we can parse the response as json
			await response.json()
		} catch (e) {
			console.log('❌ Something went wrong: ' + (e as Error).message)
			return await init(_path, { ...args, force_remote_endpoint: true })
		}
	} else {
		// the schema is local so ask them for the path
		const answers = await prompts(
			{
				message: 'Where is your schema located?',
				name: 'schema_path',
				type: 'text',
				initial: schemaPath,
			},
			{
				onCancel() {
					process.exit(1)
				},
			}
		)

		schemaPath = answers.schema_path
	}

	// try to detect which tools they are using
	const { framework, typescript, module, package_manager } = await detectTools(targetPath)

	// notify the users of what we detected
	console.log()
	console.log("🔎 Here's what we found:")

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

	// let's pull the schema only when we are using a remote endpoint
	if (is_remote_endpoint) {
		await pullSchema(url, path.join(targetPath, schemaPath), headers)
	}

	await writeConfigFile({
		configPath,
		schemaPath,
		module,
		url: is_remote_endpoint ? url : null,
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
	let cmd_install = 'npm i'
	let cmd_run = 'npm run dev'
	if (package_manager === 'pnpm') {
		cmd_install = 'pnpm i'
		cmd_run = 'pnpm dev'
	} else if (package_manager === 'yarn') {
		cmd_install = 'yarn'
		cmd_run = 'yarn dev'
	}
	console.log(`
👉 Next Steps
1️⃣  Finalize your installation: ${logGreen(cmd_install)}
2️⃣  Start your application:     ${logGreen(cmd_run)}
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
	configPath,
	schemaPath,
	module,
	url,
}: {
	configPath: string
	schemaPath: string
	module: 'esm' | 'commonjs'
	url: string | null
}): Promise<boolean> => {
	const config: ConfigFile = {}

	// if we have no url, we are using a local schema
	if (url !== null) {
		config.apiUrl = url
	}

	// if it's different for defaults, write it down
	if (schemaPath !== './schema.graphql') {
		config.schemaPath = schemaPath
	}

	// if it's different for defaults, write it down
	if (module !== 'esm') {
		config.module = module
	}

	// put plugins at the bottom
	config.plugins = {
		'houdini-svelte': {},
	}

	// the actual config contents
	const configObj = JSON.stringify(config, null, 4)
	const content_base = `/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = ${configObj}`

	const content =
		module === 'esm'
			? // ESM default config
			  `${content_base}

export default config
`
			: // CommonJS default config
			  `${content_base}}

module.exports = config
`

	await updateFile({
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
			filepath: viteConfigPath,
			content: framework === 'kit' ? viteConfigKitTs : viteConfigSvelteTs,
		})
	} else {
		await updateFile({
			filepath: viteConfigPath,
			content: framework === 'kit' ? viteConfigKit : viteConfigSvelte,
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

	// write the svelte config file
	await updateFile({
		filepath: svelteConfigPath,
		content: newContent,
	})
}

async function updateSvelteMainJs(targetPath: string) {
	const svelteMainJsPath = path.join(targetPath, 'main.js')

	const newContent = `import client from "../client";
import './app.css'
import App from './App.svelte'
import { logGreen } from '@kitql/helper'

client.init();

const app = new App({
	target: document.getElementById('app')
})

export default app
`

	await updateFile({
		filepath: svelteMainJsPath,
		content: newContent,
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
		graphql: '^15.8.0',
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
		filepath: target,
		content,
	})
}

async function gitIgnore(targetPath: string) {
	const filepath = path.join(targetPath, '.gitignore')
	const existing = (await fs.readFile(filepath)) || ''

	if (!existing.includes('\n$houdini\n')) {
		await fs.writeFile(filepath, existing + '\n$houdini\n')
	}
}

type DetectedTools = {
	typescript: boolean
	framework: 'kit' | 'sapper' | 'svelte'
	module: 'esm' | 'commonjs'
	package_manager: 'npm' | 'yarn' | 'pnpm'
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
		framework,
		module: packageJSON['type'] === 'module' ? 'esm' : 'commonjs',
		package_manager,
	}
}

async function updateFile({ filepath, content }: { filepath: string; content: string }) {
	await fs.writeFile(filepath, content)
}
