import fs from 'fs/promises'
import inquirer from 'inquirer'
import path from 'path'
import { Config, getConfig, LogLevel } from '../common'
import generate from './generate'
import { createFolderIfNotExists, writeFile } from './utils'
import { writeSchema } from './utils/writeSchema'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined, args: { pullHeader?: string[] }) => {
	// we need to collect some information from the user before we
	// can continue
	let answers = (await inquirer.prompt([
		{
			message:
				'Did you git commit everything before running init? (so that you can see all changes easily)',
			name: 'allowWritingEverywhere',
			type: 'confirm',
		},
		{
			message: 'What framework are you using?',
			name: 'framework',
			type: 'list',
			choices: [
				{ value: 'kit', name: 'SvelteKit' },
				{ value: 'svelte', name: 'Svelte' },
				{ value: 'sapper', name: 'Sapper (deprecated)' },
			],
		},
		{
			message: 'Will SvelteKit be your GraphQL endpoint as well?',
			name: 'isGraphQLEndpoint',
			type: 'confirm',
			when: ({ framework }) => framework === 'kit',
		},
		{
			message: 'Please enter the GraphQL endpoint URL (including its protocol):',
			name: 'url',
			type: 'input',
			when: ({ framework }) => framework !== 'kit',
		},
		{
			message: 'Please enter the GraphQL endpoint URL (including its protocol):',
			name: 'urlKit',
			type: 'input',
			default: 'http://localhost/api/graphql',
			when: ({ framework, isGraphQLEndpoint }) => framework === 'kit' && isGraphQLEndpoint,
		},
		{
			message: 'What kind of modules do you want to be generated?',
			name: 'module',
			type: 'list',
			when: ({ framework }) => framework === 'svelte',
			choices: [
				{ value: 'commonjs', name: 'CommonJS' },
				{ value: 'esm', name: 'ES Modules' },
			],
		},
		{
			message: 'Just to be sure, you want the magic in TypeScript?',
			name: 'isTypeScript',
			type: 'confirm',
		},
	])) as {
		allowWritingEverywhere: boolean
		framework: 'kit' | 'svelte' | 'sapper'
		isGraphQLEndpoint: boolean
		url: string
		module: 'commonjs' | 'esm'
		isTypeScript: boolean
	}

	// if the user didn't choose a module type, figure it out from the framework choice
	let module: Config['module'] = answers.module
	if (answers.framework === 'kit') {
		module = 'esm'
	} else if (answers.framework === 'sapper') {
		module = 'commonjs'
	}

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.js')
	// the config file path
	const svelteConfigPath = path.join(targetPath, 'svelte.config.js')
	// the .gitignore file path
	const gitignorePath = path.join(targetPath, '.gitignore')
	// the tsconfig file path
	const tsconfigPath = path.join(targetPath, 'tsconfig.json')
	// the layout file path
	const routesPath = path.join(targetPath, 'routes')
	const layoutPath = path.join(routesPath, '__layout.svelte')
	// where we put the houdiniClient
	const houdiniClientPath = path.join(
		sourceDir,
		answers.isTypeScript ? 'houdiniClient.ts' : 'houdiniClient.js'
	)

	const kitGraphQLEndpoint = answers.framework === 'kit' && answers.isGraphQLEndpoint
	const schemaPath = kitGraphQLEndpoint ? 'src/**/*.graphql' : './schema.graphql'

	// This need to be done before we can start writing files
	if (answers.allowWritingEverywhere) {
		await createFolderIfNotExists(routesPath)
	}

	await Promise.all([
		// Get the schema from the url and write it to file
		!kitGraphQLEndpoint &&
			writeSchema(answers.url, path.join(targetPath, schemaPath), args?.pullHeader),

		// write the config file
		writeFile(
			configPath,
			configFile({
				schemaPath,
				framework: answers.framework,
				module,
				url: answers.url,
				kitGraphQLEndpoint,
			})
		),

		// write the houdiniClient file
		writeFile(houdiniClientPath, houdiniClientFile(answers.url, answers.isTypeScript)),

		// write the svelte config file
		answers.allowWritingEverywhere && writeFile(svelteConfigPath, svelteConfigFile()),

		// write the tsConfigFile
		answers.allowWritingEverywhere &&
			answers.isTypeScript &&
			writeFile(tsconfigPath, tsConfigFile()),

		answers.allowWritingEverywhere && writeFile(layoutPath, layoutFile(answers.isTypeScript)),

		fs.appendFile(
			gitignorePath,
			`\n\n# 🎩 Houdini's folder where everything will be generated\n$houdini`
		),
	])

	// generate an empty runtime
	console.log('✨ Creating necessary files...')

	// make sure we don't log anything else
	const config = await getConfig({
		logLevel: LogLevel.Quiet,
	})
	await generate(config)

	// we're done!
	console.log('🎩 Welcome to Houdini!')

	console.log('')

	if (!answers.allowWritingEverywhere) {
		console.log('🪄  To compelte the setup, you need to:')
		console.log('  - update "svelte.config.js"')
		if (answers.isTypeScript) {
			console.log('  - update "tsconfig.json"')
		}
		console.log('  - update "routes/__layout.svelte"')
		console.log(
			'  More infos on https://www.houdinigraphql.com/guides/setting-up-your-project"'
		)
	} else {
		console.log('👉  Write your GraphQL operations...')
		console.log('👉  Run: "houdini generate" to start using them.')
	}
}

const houdiniClientFile = (url: string, isTypeScript: boolean) => {
	if (isTypeScript) {
		return `import type { RequestHandlerArgs } from '$houdini';
import { HoudiniClient } from '$houdini';

async function fetchQuery({
	fetch,
	text = '',
	variables = {},
	session,
	metadata
}: RequestHandlerArgs) {
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

export const houdiniClient = new HoudiniClient(fetchQuery);
`
	}
	return `import { HoudiniClient } from '$houdini'

async function fetchQuery({ fetch, session, text = '', variables = {}, session, metadata }) {
	const result = await fetch('${url}', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})
	return await result.json()
}

export default new HoudiniClient(fetchQuery)}
`
}

const svelteConfigFile = () => {
	return `import adapter from '@sveltejs/adapter-auto'
import houdini from 'houdini/preprocess'
import path from 'path'
import preprocess from 'svelte-preprocess'

/\*\* @type {import('@sveltejs/kit').Config} \*/
const config = {
preprocess: [preprocess(), houdini()],

	kit: {
		adapter: adapter(),

		vite: {
			resolve: {
				alias: {
					$houdini: path.resolve('.', '$houdini')
				}
			},
			server: {
				fs: {
					allow: ['.']
				}
			},
		}
	}

};

export default config;`
}

const tsConfigFile = () => {
	return `{
	"extends": "./.svelte-kit/tsconfig.json",
	"compilerOptions": {
		"paths": {
			"$houdini": ["$houdini"]
		}
	}
}
`
}

const layoutFile = (isTypeScript: boolean) => {
	return `<script context="module"${isTypeScript ? ' lang="ts"' : ''}>
	import { houdiniClient } from '../houdiniClient'; 
	
	houdiniClient.init();
</script>

<slot />
`
}

const configFile = ({
	schemaPath,
	framework,
	module,
	url,
	kitGraphQLEndpoint,
}: {
	schemaPath: string
	framework: string
	module: string
	url: string
	kitGraphQLEndpoint: boolean
}) => {
	// the actual config contents
	const configObj: string[] = []

	configObj.push(`/** @type {import('houdini').ConfigFile} */`)
	configObj.push(`const config = {`)
	configObj.push(`	schemaPath: '${schemaPath}',`)
	configObj.push(`	sourceGlob: 'src/**/*.{svelte,gql}',`)

	if (module !== 'esm') {
		configObj.push(`	module: '${module}',`)
	}
	if (framework !== 'kit') {
		configObj.push(`	framework: '${framework}',`)
	}
	if (!kitGraphQLEndpoint) {
		configObj.push(`	apiUrl: '${url}',`)
	}

	configObj.push(`	scalars: {`)
	configObj.push(`		// For your scalars configuration later...`)
	configObj.push(`	}`)
	configObj.push(`}`)
	configObj.push(``)

	// SvelteKit default config
	if (module === 'esm') {
		configObj.push(`export default config`)
	} else {
		configObj.push(`module.exports = config`)
	}

	return configObj.join('\n')
}
