import { getIntrospectionQuery } from 'graphql'
import fetch from 'node-fetch'
import path from 'path'
import prompts from 'prompts'

import { readFile, writeFile } from '../common'
import * as fs from '../common/fs'
import { ConfigFile } from '../runtime'
import { pullSchema } from './utils/introspection'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async function init(
	_path: string | undefined,
	args: { headers?: string[]; yes: boolean },
	withRunningCheck = true
): Promise<void> {
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
			})
		).running
	}
	if (!running) {
		console.log('❌ Your API must be running order to continue')
		return
	}

	let { url } = await prompts({
		message: "What's the URL for your api?",
		name: 'url',
		type: 'text',
		initial: 'http://localhost:3000/api/graphql',
	})

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
	await writeFile(houdiniClientPath, networkFile(url, typescript))
	await graphqlRCFile(targetPath)
	await gitIgnore(targetPath)

	// Config files for:
	// - kit only
	// - svelte only
	// - both (with small variants)
	if (framework === 'kit') {
		await updateLayoutFile(targetPath, typescript)
		await updateSvelteConfig(targetPath)
	} else if (framework === 'svelte') {
		await updateSvelteMainJs(targetPath)
	}
	await updateViteConfig(targetPath, framework)
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
		client: houdiniClientImport,
		apiUrl: url,
	}

	// if it's different for defaults, write it down
	if (schemaPath !== './schema.graphql') {
		config.schemaPath = schemaPath
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
		const tjsConfigFile = await readFile(configFile)
		if (tjsConfigFile) {
			var tjsConfig = JSON.parse(tjsConfigFile)
		}

		// new rootDirs (will overwrite the one in "extends": "./.svelte-kit/tsconfig.json")
		if (framework === 'kit') {
			tjsConfig.compilerOptions.rootDirs = ['.', './.svelte-kit/types', './.$houdini/types']
		} else {
			tjsConfig.compilerOptions.rootDirs = ['.', './.$houdini/types']
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

		await writeFile(configFile, JSON.stringify(tjsConfig, null, 4))
	} catch {}

	return false
}

async function updateLayoutFile(targetPath: string, ts: boolean) {
	const layoutFile = path.join(targetPath, 'src', 'routes', '+layout.svelte')

	const content = `<script ${ts ? ' lang="ts"' : ''}>
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

async function updateViteConfig(targetPath: string, framework: 'kit' | 'svelte') {
	const viteConfigPath = path.join(targetPath, 'vite.config.js')

	const oldViteConfig1 = `import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()]
};

export default config;
`

	const oldViteConfig2 = `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()]
})
`

	const viteConfigKit = `import { sveltekit } from '@sveltejs/kit/vite';
import houdini from 'houdini/vite';

/** @type {import('vite').UserConfig} */
const config = {
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

	// write the vite config file
	await updateFile({
		projectPath: targetPath,
		filepath: viteConfigPath,
		content: framework === 'kit' ? viteConfigKit : viteConfigSvelte,
		old: [oldViteConfig1, oldViteConfig2],
	})
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
	const packageFile = await readFile(packagePath)
	if (packageFile) {
		packageJSON = JSON.parse(packageFile)
	}

	// houdini & graphql should be a dev dependencies
	packageJSON.devDependencies = {
		...packageJSON.devDependencies,
		houdini: '^HOUDINI_VERSION',
		graphql: '^15.5.0',
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
		const { done } = await prompts({
			name: 'done',
			type: 'confirm',
			message: 'Should we overwrite the file? If not, please update it manually.',
		})

		if (!done) {
			return
		}
	}

	// if we got this far we are safe to write the file
	await writeFile(filepath, content)
}
