import { defineAddon, defineAddonOptions } from 'sv'
import { transforms } from './sv-utils.js'

const options = defineAddonOptions()
	.add('is_remote_endpoint', {
		question: 'Will you use a remote GraphQL API?',
		type: 'boolean',
		default: true,
	})
	.add('remote_endpoint', {
		question: "What's the URL for your api?",
		type: 'string',
		default: '',
		placeholder: 'http://localhost:4000/graphql',
		validate: (value) => {
			if (!value?.startsWith('http')) {
				return 'Please enter a valid URL'
			}
		},
		// Only ask if specified to be using a remote endpoint
		condition: (opts) => opts.is_remote_endpoint === true,
	})
	.add('local_schema', {
		question: "Where's your schema located?",
		type: 'string',
		default: '',
		validate: (value) => {
			if (value === '') {
				return 'Please enter a valid schemaPath'
			}
		},
		// Only ask if specified to be using a local schema
		condition: (opts) => opts.is_remote_endpoint === false,
	})
	.build()

export default defineAddon({
	id: '@houdinigraphql/sv',
	shortDescription: 'GraphQL client library',
	homepage: 'https://houdinigraphql.com',
	options,

	setup: ({ isKit, unsupported }) => {
		if (!isKit) unsupported('Requires SvelteKit')
	},

	nextSteps: () => ['Check the Houdini tutorial at https://houdinigraphql.com/intro'],

	run: ({ directory, sv, options, language }) => {
		sv.dependency('houdini', '2.0.5')
		sv.dependency('houdini-svelte', '3.0.2')
		sv.devDependency('houdini-lsp', '2.0.5')

		sv.file(
			'houdini.config.js',
			transforms.script(({ ast, comments, content, js }) => {
				// Don't overwrite if a config is already present
				if (content) return false

				ast.body.push(
					js.variables.declaration(ast, {
						kind: 'const',
						name: 'config',
						value: js.object.create({
							watchSchema: options.is_remote_endpoint
								? { url: options.remote_endpoint }
								: undefined,
							schemaPath: !options.is_remote_endpoint
								? options.local_schema
								: undefined,
							runtimeDir: '.houdini',
							plugins: {
								'houdini-svelte': {},
							},
						}),
					})
				)

				js.exports.createDefault(ast, {
					fallback: js.variables.createIdentifier('config'),
				})
			})
		)

		// TODO:
		// sv.file(
		//   `${directory.src}/client.${language}`,
		//   transforms.script(({ ast, comments, content, js }) => {
		//     // Don't oerwrite if a client is already present
		//     if (content) return false
		//
		//     js.imports.addNamed(ast, {
		//       imports: ['HoudiniClient'],
		//       from: '$houdini',
		//     })
		//
		//     js.exports.createDefault(ast, {
		//       fallback: js.object.create({
		//         url: options.remote_endpoint
		//       })
		//     })
		//   })
		// )

		sv.file(
			`vite.config.${language}`,
			transforms.script(({ ast, js }) => {
				js.imports.addDefault(ast, {
					from: 'houdini/vite',
					as: 'houdini',
				})
				js.vite.addPlugin(ast, {
					code: 'houdini()',
					mode: 'prepend',
				})
			})
		)

		// sv.file(
		// 	`${directory.lib}/@houdinigraphql/sv/content.txt`,
		// 	transforms.text(() => {
		// 		return `This is a text file made by the Community Addon Template demo for the add-on: '@houdinigraphql/sv'!`
		// 	})
		// )
		//
		// sv.file(
		// 	`${directory.lib}/@houdinigraphql/sv/HelloComponent.svelte`,
		// 	transforms.svelteScript({ language }, ({ ast, svelte, js }) => {
		// 		js.imports.addDefault(ast.instance.content, {
		// 			as: 'content',
		// 			from: './content.txt?raw',
		// 		})
		//
		// 		svelte.addFragment(ast, '<p>{content}</p>')
		// 		svelte.addFragment(ast, `<h2>Hello ${options.who}!</h2>`)
		// 	})
		// )
		//
		// sv.file(
		// 	directory.kitRoutes + '/+page.svelte',
		// 	transforms.svelteScript({ language }, ({ ast, svelte, js }) => {
		// 		js.imports.addDefault(ast.instance.content, {
		// 			as: 'HelloComponent',
		// 			from: `$lib/@houdinigraphql/sv/HelloComponent.svelte`,
		// 		})
		//
		// 		svelte.addFragment(ast, '<HelloComponent />')
		// 	})
		// )
	},
})
