import * as p from '@clack/prompts'
import { bold, cyan, gray, green, italic } from 'kleur/colors'
import { execSync } from 'node:child_process'
import * as recast from 'recast'

import type { HoudiniFrameworkInfo } from '../lib'
import {
	detectTools,
	extractHeaders,
	extractHeadersStr,
	fs,
	parseJSON,
	path,
	pullSchema,
} from '../lib'
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
		yes?: boolean
	}
): Promise<void> {
	p.intro('🎩 Welcome to Houdini!')

	// before we start anything, let's make sure they have initialized their project
	try {
		await fs.stat(path.resolve('./src'))
	} catch {
		throw new Error(
			'Please initialize your project first before running init. For svelte projects, you should follow the instructions here: https://kit.svelte.dev/'
		)
	}

	let headers = extractHeaders(args.headers)

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// git check
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

	// Questions...
	let url = 'http://localhost:5173/api/graphql'
	let is_remote_endpoint = true
	if (!args.yes) {
		is_remote_endpoint = (
			await p.group(
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
		).is_remote_endpoint
	}

	let schemaPath = is_remote_endpoint ? './schema.graphql' : 'path/to/src/lib/**/*.graphql'

	let pullSchema_content: string | null = null
	if (is_remote_endpoint && !args.yes) {
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

			// Since we don't have a config file yet, we need to provide the default here.
			const fetchTimeout = 30000
			pullSchema_content = await pullSchema(
				local_url,
				fetchTimeout,
				schemaPath,
				local_headers,
				true
			)

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
	} else if (!args.yes) {
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

	// try to detect which tools they are using
	const { frameworkInfo, typescript, module, package_manager } = await detectTools(targetPath)

	// notify the users of what we detected
	const found_to_log = []
	// framework
	if (frameworkInfo.framework === 'svelte') {
		found_to_log.push('✨ Svelte')
	} else if (frameworkInfo.framework === 'kit') {
		found_to_log.push('✨ SvelteKit')
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
		await svelteMainJs(targetPath, typescript)
	} else if (frameworkInfo.framework === 'kit') {
		await svelteConfig(targetPath, typescript)
	}

	// Global files
	await gitIgnore(targetPath)
	await graphqlRC(targetPath)
	await viteConfig(targetPath, frameworkInfo, typescript)
	await tjsConfig(targetPath, frameworkInfo)
	await packageJSON(targetPath, frameworkInfo)

	s.stop(`Houdini's files generated ${green('✓')}`)

	// we're done!
	p.outro('🎉 Everything is ready!')

	finale_logs(package_manager)
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
	console.log(`👉 Next Steps`)
	console.log(`1️⃣  Finalize your installation: ${green(cmd_install)}
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
async function houdiniConfig(
	configPath: string,
	schemaPath: string,
	module: 'esm' | 'commonjs',
	frameworkInfo: HoudiniFrameworkInfo,
	url: string | null
): Promise<boolean> {
	const config: ConfigFile = {}

	// if we have no url, we are using a local schema
	if (url !== null) {
		config.watchSchema = {
			url,
		}
	}

	config.runtimeDir = '.houdini'

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

async function houdiniClient(
	targetPath: string,
	typescript: boolean,
	frameworkInfo: HoudiniFrameworkInfo,
	url: string
) {
	// where we put the houdiniClient
	const houdiniClientExt = typescript ? `ts` : `js`
	const houdiniClientPath = path.join(targetPath, `client.${houdiniClientExt}`)

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
async function svelteMainJs(targetPath: string, typescript: boolean) {
	const mainFile = typescript ? 'main.ts' : 'main.js'
	const svelteMainJsPath = path.join(targetPath, 'src', mainFile)

	const mainContents = await fs.readFile(svelteMainJsPath)

	if (!mainContents) {
		throw new Error(`Failed to update ${mainFile} - cannot read`)
	}

	const newContent = `import client from "./client";\n` + mainContents

	await fs.writeFile(svelteMainJsPath, newContent)
}

async function svelteConfig(targetPath: string, typescript: boolean) {
	const svelteConfigPath = path.join(targetPath, 'svelte.config.js')

	const contents = await fs.readFile(svelteConfigPath)
	if (!contents) {
		throw new Error('Failed to patch svelte config: cannot open file')
	}

	const ast = recast.parse(contents)
	recast.visit(ast, {
		visitProperty(path) {
			if (
				path.node.key.type === 'Identifier' &&
				path.node.key.name === 'kit' &&
				path.node.value.type === 'ObjectExpression'
			) {
				const houdiniAlias: recast.types.namedTypes.Property = {
					type: 'Property',
					key: { type: 'Identifier', name: '$houdini' },
					value: { type: 'StringLiteral', value: '.houdini/' },
					kind: 'init',
				}

				let aliasProperty = path.node.value.properties.find(
					(p) =>
						p.type === 'Property' &&
						p.key.type === 'Identifier' &&
						p.key.name === 'alias'
				)

				if (
					aliasProperty &&
					aliasProperty.type === 'Property' &&
					aliasProperty.value.type === 'ObjectExpression'
				) {
					// Overwrite the alias if it exists. if not, create it.
					const existingAlias = aliasProperty.value.properties.find(
						(x) =>
							x.type === 'Property' &&
							x.key.type === 'Identifier' &&
							x.key.name === '$houdini'
					) as recast.types.namedTypes.Property | null
					if (existingAlias) {
						existingAlias.value = houdiniAlias.value
					} else {
						aliasProperty.value.properties.push(houdiniAlias)
					}
				} else {
					path.node.value.properties.push({
						type: 'Property',
						key: { type: 'Identifier', name: 'alias' },
						value: {
							type: 'ObjectExpression',
							properties: [houdiniAlias],
						},
						kind: 'init',
					})
				}
			}
			return false
		},
	})

	// write the svelte config file
	await fs.writeFile(svelteConfigPath, recast.print(ast).code)
}

/******************************/
/*  Global files              */
/******************************/
async function gitIgnore(targetPath: string) {
	const filepath = path.join(targetPath, '.gitignore')
	const existing = (await fs.readFile(filepath)) || ''

	if (!existing.includes('\n.houdini\n')) {
		await fs.writeFile(filepath, existing + '\n.houdini\n')
	}
}

async function graphqlRC(targetPath: string) {
	// the filepath for the rcfile
	const target = path.join(targetPath, '.graphqlrc.yaml')

	const content = `projects:
  default:
    schema:
      - ./schema.graphql
      - ./.houdini/graphql/schema.graphql
    documents:
      - '**/*.gql'
      - '**/*.svelte'
      - ./.houdini/graphql/documents.gql
`

	await fs.writeFile(target, content)
}

async function viteConfig(
	targetPath: string,
	frameworkInfo: HoudiniFrameworkInfo,
	typescript: boolean
) {
	const viteConfigPath = path.join(targetPath, typescript ? 'vite.config.ts' : 'vite.config.js')

	let contents = await fs.readFile(viteConfigPath)
	if (!contents) {
		throw new Error('Failed to patch vite config: cannot open file')
	}

	const ast = recast.parse(contents)

	const houdiniImport: recast.types.namedTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		specifiers: [
			{
				type: 'ImportDefaultSpecifier',
				local: { type: 'Identifier', name: 'houdini' },
			},
		],
		source: { type: 'Literal', value: 'houdini/vite' },
	}
	ast.program.body.unshift(houdiniImport)

	// Add the `houdini` plugin to the AST
	recast.visit(ast, {
		visitProperty(path) {
			if (path.node.key.type === 'Identifier' && path.node.key.name === 'plugins') {
				if (path.node.value.type === 'ArrayExpression') {
					path.node.value.elements.unshift({
						type: 'CallExpression',
						callee: {
							type: 'Identifier',
							name: 'houdini',
						},
						arguments: [],
					})
				}
			}
			return false
		},
	})

	if (frameworkInfo.framework === 'svelte') {
		const houdiniAliasProperty: recast.types.namedTypes.Property = {
			type: 'Property',
			key: { type: 'Identifier', name: '$houdini' },
			value: { type: 'StringLiteral', value: '.houdini/' },
			kind: 'init',
		}

		const aliasValue: recast.types.namedTypes.ObjectExpression = {
			type: 'ObjectExpression',
			properties: [houdiniAliasProperty],
		}

		const resolveValue: recast.types.namedTypes.ObjectExpression = {
			type: 'ObjectExpression',
			properties: [
				{
					type: 'Property',
					key: { type: 'Identifier', name: 'alias' },
					value: aliasValue,
					kind: 'init',
				},
			],
		}

		// Add `$houdini` alias to `resolve.alias`
		recast.visit(ast, {
			visitCallExpression(path) {
				const config = path.node.arguments[0]
				if (!config || config.type !== 'ObjectExpression') {
					throw new Error(
						"Failed to patch vite config: Couldn't update `defineConfig` param - not an object"
					)
				}

				// Find the `resolve` object in the config
				const resolveProperty = config.properties.find(
					(x) =>
						x.type === 'Property' &&
						x.key.type === 'Identifier' &&
						x.key.name === 'resolve'
				) as recast.types.namedTypes.Property | null
				if (!resolveProperty) {
					config.properties.push({
						type: 'Property',
						key: { type: 'Identifier', name: 'resolve' },
						value: resolveValue,
						kind: 'init',
					})
				} else {
					if (resolveProperty.value.type !== 'ObjectExpression') {
						throw new Error(
							"Failed to patch vite config: Couldn't update `resolve` field - not an object"
						)
					}

					// Find the `alias` object in the `resolve` object
					const aliasProperty = resolveProperty.value.properties.find(
						(x) =>
							x.type === 'Property' &&
							x.key.type === 'Identifier' &&
							x.key.name === 'alias'
					) as recast.types.namedTypes.Property | null
					if (!aliasProperty) {
						resolveProperty.value.properties.push({
							type: 'Property',
							key: { type: 'Identifier', name: 'alias' },
							value: aliasValue,
							kind: 'init',
						})
					} else {
						if (aliasProperty.value.type !== 'ObjectExpression') {
							throw new Error(
								"Failed to patch vite config: Couldn't update `alias` field - not an object"
							)
						}

						// Make sure the `$houdini` alias is correct
						const houdiniAlias = aliasProperty.value.properties.find(
							(x) =>
								x.type === 'Property' &&
								x.key.type === 'Identifier' &&
								x.key.name === '$houdini'
						) as recast.types.namedTypes.Property | null
						if (!houdiniAlias) {
							// Add the alias if it doesn't exist yet.
							aliasProperty.value.properties.push(houdiniAliasProperty)
						} else {
							houdiniAlias.value = houdiniAliasProperty.value
						}
					}
				}
				return false
			},
		})
	}

	contents = recast.print(ast).code

	await fs.writeFile(viteConfigPath, recast.print(ast).code)
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

		// new rootDirs (will overwrite the one in "extends": "./.svelte-kit/tsconfig.json")
		if (frameworkInfo.framework === 'svelte') {
			tjsConfig.compilerOptions.rootDirs = ['.', './.houdini/types']
		} else if (frameworkInfo.framework === 'kit') {
			tjsConfig.compilerOptions.rootDirs = ['.', './.svelte-kit/types', './.houdini/types']
		}

		// In kit, no need to add manually the path. Why? Because:
		//   The config [svelte.config.js => kit => alias => $houdini]
		//   will make this automatically in "extends": "./.svelte-kit/tsconfig.json"
		// In svelte, we need to add the path manually
		if (frameworkInfo.framework === 'svelte') {
			tjsConfig.compilerOptions.paths = {
				...tjsConfig.compilerOptions.paths,
				$houdini: ['./.houdini/'],
				'$houdini/*': ['./.houdini/*'],
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
		houdini: '^HOUDINI_PACKAGE_VERSION',
	}

	if (frameworkInfo.framework === 'svelte' || frameworkInfo.framework === 'kit') {
		packageJSON.devDependencies = {
			...packageJSON.devDependencies,
			'houdini-svelte': '^HOUDINI_SVELTE_PACKAGE_VERSION',
		}
	} else {
		throw new Error(`Unmanaged framework: "${JSON.stringify(frameworkInfo)}"`)
	}

	await fs.writeFile(packagePath, JSON.stringify(packageJSON, null, 4))
}
