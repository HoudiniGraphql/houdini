import * as p from '@clack/prompts'
import { bold, cyan, gray, green, italic } from 'kleur/colors'
import { execSync } from 'node:child_process'

import type { HoudiniFrameworkInfo } from '.'
import { detectTools, extractHeaders, extractHeadersStr, fs, parseJSON, path, pullSchema } from '.'
import type { ConfigFile } from '../runtime/lib/config'

function pCancel(cancelText = 'Operation cancelled.') {
	p.cancel(cancelText)
	process.exit(1)
}

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export async function init(
	_path: string | undefined,
	args: {
		headers?: string[]
		with_intro?: boolean
		check_is_in_project?: boolean
		check_is_git_clean?: boolean
		after_questions?: () => Promise<void>
		with_found_info?: boolean
		with_outro?: boolean
		with_finale_logs?: boolean
	}
): Promise<void> {
	const with_intro = args.with_intro ?? true
	const check_is_in_project = args.check_is_in_project ?? true
	const check_is_git_clean = args.check_is_git_clean ?? true
	const with_found_info = args.with_found_info ?? true
	const with_outro = args.with_outro ?? true
	const with_finale_logs = args.with_finale_logs ?? true

	if (with_intro) {
		p.intro('🎩 Welcome to Houdini!')
	}

	if (check_is_in_project) {
		// before we start anything, let's make sure they have initialized their project
		try {
			await fs.stat(path.resolve('./src'))
		} catch {
			throw new Error(
				'Please initialize your project first before running init. For svelte projects, you should follow the instructions here: https://kit.svelte.dev/'
			)
		}
	}

	let headers = extractHeaders(args.headers)

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// git check
	if (check_is_git_clean) {
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
				const { confirm } = await p.group(
					{
						confirm: () => {
							p.log.warning(
								`Your git working directory is dirty — we recommend committing your changes before running this migration.`
							)
							return p.confirm({
								message: `Continue anyway?`,
								initialValue: false,
							})
						},
					},
					{
						onCancel: () => pCancel(),
					}
				)

				if (confirm !== true) {
					pCancel()
				}
			}
		}
	}

	// Questions...
	let url = 'http://localhost:5173/api/graphql'
	const { is_remote_endpoint } = await p.group(
		{
			is_remote_endpoint: () =>
				p.confirm({
					message: 'Will you use a remote GraphQL API?',
					initialValue: true,
				}),
		},
		{
			onCancel: () => pCancel(),
		}
	)

	let schemaPath = is_remote_endpoint
		? path.join(targetPath, 'schema.graphql')
		: 'path/to/src/lib/**/*.graphql'

	let pullSchema_content: string | null = null
	if (is_remote_endpoint) {
		let number_of_round = 0
		let url_and_headers = ''
		while (pullSchema_content === null && number_of_round < 10) {
			number_of_round++
			const answer = await p.group(
				{
					url_and_headers: async () =>
						p.text({
							message: `What's the URL for your api? ${
								number_of_round === 1 ? '' : `(attempt ${number_of_round})`
							}`,
							placeholder: `http://localhost:4000/graphql ${
								number_of_round === 1 ? '' : 'Authorization=Bearer MyToken'
							}`,
							// initialValue: url_and_headers,
							validate: (value) => {
								// If empty, let's assume the placeholder value
								if (value === '') {
									return
								}

								if (!value.startsWith('http')) {
									return 'Please enter a valid URL'
								}
							},
						}),
				},
				{
					onCancel: () => pCancel(),
				}
			)

			url_and_headers = answer.url_and_headers
			const value_splited = url_and_headers.split(' ')
			const local_url = value_splited[0]

			const local_headers =
				value_splited.length > 1
					? // remove the url and app all the headers
					  extractHeadersStr(value_splited.slice(1).join(' '))
					: headers

			pullSchema_content = await pullSchema(local_url, schemaPath, local_headers, true)

			if (pullSchema_content === null) {
				const msg = `If you need to pass headers, add them after the URL (eg: '${green(
					`http://myurl.com/graphql Authorization=Bearer MyToken`
				)}')`
				p.log.error(msg)
			}

			// set the url for later
			url = url_and_headers === '' ? 'http://localhost:4000/graphql' : local_url
		}

		// if we are here... it means that we have tried x times to pull the schema and it failed
		if (pullSchema_content === null) {
			pCancel("We couldn't pull the schema. Please check your URL/headers and try again.")
		}
	} else {
		// the schema is local so ask them for the path
		const answers = await p.group(
			{
				schema_path: () =>
					p.text({
						message: 'Where is your schema located?',
						placeholder: schemaPath,
						validate: (value) => {
							if (value === '') {
								return 'Please enter a valid schemaPath'
							}
						},
					}),
			},
			{
				onCancel: () => pCancel(),
			}
		)

		schemaPath = answers.schema_path
	}

	if (args.after_questions) {
		args.after_questions()
	}

	// Let's write the schema only now (after the function "after_questions" where the project has been created)
	if (is_remote_endpoint && pullSchema_content) {
		await fs.writeFile(schemaPath, pullSchema_content)
	}

	// try to detect which tools they are using
	const { frameworkInfo, typescript, module, package_manager } = await detectTools(targetPath)

	// notify the users of what we detected
	if (with_found_info) {
		const found_to_log = []
		// framework
		if (frameworkInfo.framework === 'svelte') {
			found_to_log.push('✨ Svelte')
		} else if (frameworkInfo.framework === 'kit') {
			found_to_log.push('✨ SvelteKit')
		} else if (frameworkInfo.framework === 'react') {
			found_to_log.push('✨ React')
		} else {
			throw new Error(`Unmanaged framework: "${JSON.stringify(frameworkInfo)}"`)
		}

		// module
		if (module === 'esm') {
			found_to_log.push('📦 ES Modules')
		} else {
			found_to_log.push('📦 CommonJS')
		}

		// typescript
		if (typescript) {
			found_to_log.push('🟦 TypeScript')
		} else {
			found_to_log.push('🟨 JavaScript')
		}

		p.log.info(`Here's what we found: ${found_to_log.join(', ')}`)
	}

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.js')

	const s = p.spinner()
	s.start(`🚧 Generating houdini's files...`)

	// Houdini's files
	await houdiniConfig(
		configPath,
		schemaPath,
		module,
		frameworkInfo,
		is_remote_endpoint ? url : null
	)
	await houdiniClient(sourceDir, typescript, frameworkInfo, url)

	// Framework specific files
	if (frameworkInfo.framework === 'svelte') {
		await svelteKitConfig(targetPath, typescript)
	} else if (frameworkInfo.framework === 'kit') {
		await svelteConfig(targetPath, typescript)
	} else if (frameworkInfo.framework === 'react') {
		await reactRouter(sourceDir, typescript)
	}

	// Global files
	await gitIgnore(targetPath)
	await graphqlRC(targetPath)
	await viteConfig(targetPath, frameworkInfo, typescript)
	await tjsConfig(targetPath, frameworkInfo)
	await packageJSON(targetPath, frameworkInfo)

	s.stop(`Houdini's files generated ${green('✓')}`)

	// we're done!
	if (with_outro) {
		p.outro('🎉 Everything is ready!')
	}

	if (with_finale_logs) {
		finale_logs(package_manager)
	}
}

export function finale_logs(package_manager: 'npm' | 'yarn' | 'pnpm') {
	let cmd_install = 'npm i'
	let cmd_run = 'npm run dev'
	if (package_manager === 'pnpm') {
		cmd_install = 'pnpm i'
		cmd_run = 'pnpm dev'
	} else if (package_manager === 'yarn') {
		cmd_install = 'yarn'
		cmd_run = 'yarn dev'
	}
	console.log(`👉 Next Steps
1️⃣  Finalize your installation: ${green(cmd_install)}
2️⃣  Start your application:     ${green(cmd_run)}
`)

	console.log(
		gray(
			italic(
				`${bold('❔ More help')} at ${cyan(
					'https://houdinigraphql.com'
				)} (📄 Docs, ⭐ Github, 📣 Discord, ...)
`
			)
		)
	)
}

/******************************/
/*  Houdini's files           */
/******************************/
const houdiniConfig = async (
	configPath: string,
	schemaPath: string,
	module: 'esm' | 'commonjs',
	frameworkInfo: HoudiniFrameworkInfo,
	url: string | null
): Promise<boolean> => {
	const config: ConfigFile = {}

	// if we have no url, we are using a local schema
	if (url !== null) {
		config.watchSchema = {
			url,
		}
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
	if (frameworkInfo.framework === 'svelte') {
		config.plugins = {
			'houdini-svelte': {
				framework: 'svelte',
			},
		}
	} else if (frameworkInfo.framework === 'kit') {
		config.plugins = {
			'houdini-svelte': {},
		}
	} else if (frameworkInfo.framework === 'react') {
		config.plugins = {
			'houdini-react': {},
		}
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

	await fs.writeFile(configPath, content)

	return false
}

const houdiniClient = async (
	targetPath: string,
	typescript: boolean,
	frameworkInfo: HoudiniFrameworkInfo,
	url: string
) => {
	// where we put the houdiniClient
	const houdiniClientPrefix = frameworkInfo.framework === 'react' ? `+` : ``
	const houdiniClientExt = typescript ? `ts` : `js`
	const houdiniClientPath = path.join(
		targetPath,
		`${houdiniClientPrefix}client.${houdiniClientExt}`
	)

	const content = `import { HoudiniClient } from '$houdini';

export default new HoudiniClient({
    url: '${url}'

    // uncomment this to configure the network call (for things like authentication)
    // for more information, please visit here: https://www.houdinigraphql.com/guides/authentication
    // fetchParams({ session }) { 
    //     return { 
    //         headers: {
    //             Authentication: \`Bearer \${session.token}\`,
    //         }
    //     }
    // }
})
`

	await fs.writeFile(houdiniClientPath, content)
}

/******************************/
/*  Framework specific files  */
/******************************/
async function svelteKitConfig(targetPath: string, typescript: boolean) {
	const svelteMainJsPath = path.join(targetPath, 'src', typescript ? 'main.ts' : 'main.js')

	const newContent = `import client from "./client";
import './app.css'
import App from './App.svelte'

const app = new App({
	target: document.getElementById('app')
})

export default app
`

	await fs.writeFile(svelteMainJsPath, newContent)
}

async function svelteConfig(targetPath: string, typescript: boolean) {
	const svelteConfigPath = path.join(targetPath, 'svelte.config.js')

	const newContentTs = `import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			$houdini: './$houdini',
		}
	}
};

export default config;
`

	const newContentJs = `import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
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
	await fs.writeFile(svelteConfigPath, typescript ? newContentTs : newContentJs)
}

async function reactRouter(targetPath: string, typescript: boolean) {
	// index file
	const indexPath = path.join(targetPath, `+index.${typescript ? 't' : 'j'}sx`)

	const indexContent = `import React from 'react'

export default function App({ children }) {
	return (
		<html>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>My App</title>
			</head>
			<body>
				<ErrorBoundary>{children}</ErrorBoundary>
			</body>
		</html>
	)
}

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(error) {
		return { hasError: true }
	}

	componentDidCatch(error, info) {
		console.error('ErrorBoundary caught an error:', error, info)
	}

	render() {
		if (this.state.hasError) {
			return <h1>Something went wrong.</h1>
		}
		return this.props.children
	}
}
`

	await fs.writeFile(indexPath, indexContent)

	// create routes directory
	await fs.mkdir(path.join(targetPath, 'routes'))

	// demo layout page
	await fs.writeFile(
		path.join(targetPath, 'routes', `+layout.gql`),
		`# Layout query (just as example, you can delete it)
query LayoutQuery {
	__typename
}
`
	)

	await fs.writeFile(
		path.join(targetPath, 'routes', `+layout.${typescript ? 't' : 'j'}sx`),
		`import { Link } from '$houdini'

${
	typescript
		? `import type { LayoutProps } from './$types'
`
		: ''
}
export default function ({ children, LayoutQuery }${typescript ? ': LayoutProps' : ''}) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
			<pre>+layout:{JSON.stringify(LayoutQuery)}</pre>
			<div>{children}</div>
		</div>
	)
}
`
	)

	await fs.writeFile(
		path.join(targetPath, 'routes', `+page.${typescript ? 't' : 'j'}sx`),
		`${
			typescript
				? `import type { PageProps } from './$types'
`
				: ''
		}		
export default function ({ LayoutQuery }${typescript ? ': PageProps' : ''}) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
			<div>My Page</div>
			<pre>+page:{JSON.stringify(LayoutQuery)}</pre>
		</div>
	)
}		
`
	)

	await fs.remove(path.join(targetPath, 'App.css'))
	await fs.remove(path.join(targetPath, `App.${typescript ? 't' : 'j'}sx`))
	await fs.remove(path.join(targetPath, `index.css`))
	await fs.remove(path.join(targetPath, `main.${typescript ? 't' : 'j'}sx`))
}

/******************************/
/*  Global files              */
/******************************/
async function gitIgnore(targetPath: string) {
	const filepath = path.join(targetPath, '.gitignore')
	const existing = (await fs.readFile(filepath)) || ''

	if (!existing.includes('\n$houdini\n')) {
		await fs.writeFile(filepath, existing + '\n$houdini\n')
	}
}

async function graphqlRC(targetPath: string) {
	// the filepath for the rcfile
	const target = path.join(targetPath, '.graphqlrc.yaml')

	const content = `projects:
	default:
		schema:
			- ./schema.graphql
			- ./$houdini/graphql/schema.graphql
		documents:
			- '**/*.gql'
			- '**/*.svelte'
			- ./$houdini/graphql/documents.gql
`

	await fs.writeFile(target, content)
}

async function viteConfig(
	targetPath: string,
	frameworkInfo: HoudiniFrameworkInfo,
	typescript: boolean
) {
	const viteConfigPath = path.join(targetPath, typescript ? 'vite.config.ts' : 'vite.config.js')

	let content = 'NO_CONTENT_THIS_SHOULD_NEVER_BE_SEEN'
	if (frameworkInfo.framework === 'svelte') {
		content = `import { svelte } from '@sveltejs/vite-plugin-svelte'
import houdini from 'houdini/vite'
import * as path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [houdini(), svelte()],

	resolve: {
		alias: {
			$houdini: path.resolve('$houdini'),
		},
	},
})	
	`
	} else if (frameworkInfo.framework === 'kit') {
		content = `import { sveltekit } from '@sveltejs/kit/vite'
import houdini from 'houdini/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [houdini(), sveltekit()]
});
`
	} else if (frameworkInfo.framework === 'react') {
		let reactImport = '@vitejs/plugin-react'
		if (frameworkInfo.framework_specific === 'react-swc') {
			reactImport = '@vitejs/plugin-react-swc'
		}

		content = `import react from '${reactImport}'
import { path } from 'houdini'
import houdini from 'houdini/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [houdini(), react()],
	// TODO: the vite plugin should do this
	resolve: {
		alias: {
			$houdini: path.resolve('.', '/$houdini'),
			'$houdini/*': path.resolve('.', '/$houdini', '*'),
		},
	},
})
	`
	} else {
		throw new Error(`Unmanaged framework: "${JSON.stringify(frameworkInfo)}"`)
	}

	await fs.writeFile(viteConfigPath, content)
}

async function tjsConfig(targetPath: string, frameworkInfo: HoudiniFrameworkInfo) {
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

		// in react, let's overwrite completly the config like this:
		if (frameworkInfo.framework === 'react') {
			tjsConfig = {
				extends: './$houdini/tsconfig.json',
			}
		} else {
			// new rootDirs (will overwrite the one in "extends": "./.svelte-kit/tsconfig.json")
			if (frameworkInfo.framework === 'svelte') {
				tjsConfig.compilerOptions.rootDirs = ['.', './$houdini/types']
			} else if (frameworkInfo.framework === 'kit') {
				tjsConfig.compilerOptions.rootDirs = [
					'.',
					'./.svelte-kit/types',
					'./$houdini/types',
				]
			}

			// In kit, no need to add manually the path. Why? Because:
			//   The config [svelte.config.js => kit => alias => $houdini]
			//   will make this automatically in "extends": "./.svelte-kit/tsconfig.json"
			// In svelte, we need to add the path manually
			if (frameworkInfo.framework === 'svelte') {
				tjsConfig.compilerOptions.paths = {
					...tjsConfig.compilerOptions.paths,
					$houdini: ['./$houdini'],
					'$houdini/*': ['./$houdini/*'],
				}
			}
		}

		await fs.writeFile(configFile, JSON.stringify(tjsConfig, null, 4))
	} catch {}

	return false
}

async function packageJSON(targetPath: string, frameworkInfo: HoudiniFrameworkInfo) {
	let packageJSON: Record<string, any> = {}

	const packagePath = path.join(targetPath, 'package.json')
	const packageFile = await fs.readFile(packagePath)
	if (packageFile) {
		packageJSON = JSON.parse(packageFile)
	}

	// houdini should be a dev dependencies
	packageJSON.devDependencies = {
		...packageJSON.devDependencies,
		houdini: '^PACKAGE_VERSION',
	}

	if (frameworkInfo.framework === 'svelte' || frameworkInfo.framework === 'kit') {
		packageJSON.devDependencies = {
			...packageJSON.devDependencies,
			'houdini-svelte': '^PACKAGE_VERSION',
		}
	} else if (frameworkInfo.framework === 'react') {
		packageJSON.dependencies = {
			...packageJSON.dependencies,
			'react-streaming': '^0.3.10',
		}
		packageJSON.devDependencies = {
			...packageJSON.devDependencies,
			'houdini-react': '^PACKAGE_VERSION',
		}
	} else {
		throw new Error(`Unmanaged framework: "${JSON.stringify(frameworkInfo)}"`)
	}

	await fs.writeFile(packagePath, JSON.stringify(packageJSON, null, 4))
}
