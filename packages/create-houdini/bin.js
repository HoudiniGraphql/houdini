#!/usr/bin/env node
import * as p from '@clack/prompts'
import { execSync, spawn, spawnSync } from 'child_process'
import { create as create_svelte } from 'create-svelte'
import { bold, cyan, gray, green, grey, italic } from 'kleur/colors'
import fs from 'node:fs'
import path from 'node:path'

const { version } = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url), 'utf-8'))
let cwd = process.argv[2] || '.'

console.log(`
${grey(`create-houdini version ${version}`)}
`)

p.intro('🎩 Welcome to Houdini!')

// project location
if (cwd === '.') {
	const dir = await p.text({
		message: 'Where should we create your project?',
		placeholder: '  (hit Enter to use current directory)',
	})

	if (p.isCancel(dir)) process.exit(1)

	if (dir) {
		cwd = /** @type {string} */ (dir)
	}
}

// project location emtpy?
if (fs.existsSync(cwd)) {
	if (fs.readdirSync(cwd).length > 0) {
		const force = await p.confirm({
			message: 'Directory not empty. Continue?',
			initialValue: false,
		})

		// bail if `force` is `false` or the user cancelled with Ctrl-C
		if (force !== true) {
			process.exit(1)
		}
	}
}

const framework = await p.select({
	message: 'Which framework do you want to use?',
	initialValue: 'svelte',
	options: [
		{
			label: 'Svelte',
			hint: 'A new SvelteKit project with Houdini as GraphQL Client (SSR, CSR, ...)',
			value: 'svelte',
		},
		{
			label: 'React',
			hint: 'A new React project with Houdini as meta-framework (SSR, CSR, ...)',
			value: 'react',
		},
	],
})

const project_name = path.basename(path.resolve(cwd))

const s = p.spinner()
s.start('Preparing project')
if (framework === 'react') {
	execSync(`npm create vite@4.4.1 ${project_name} -- --template react-swc-ts`)
} else if (framework === 'svelte') {
	await create_svelte(cwd, {
		name: project_name,
		template: 'skeleton',
		types: 'typescript',
		prettier: true,
		eslint: true,
		playwright: true,
		vitest: true,
	})
} else {
	p.cancel('Unmanaged framework, sorry!')
}
s.stop(`Project created ${green('✓')}`)

p.outro('🎉 Everything is ready!')

console.log(`${bold('👉 Next Steps')}
1️⃣  Finalize your installation: ${green('cmd_install')}
2️⃣  Start your application:     ${green('cmd_run')}
`)

console.log(
	gray(
		italic(
			`${bold('❔ More help')} at ${cyan(
				'https://houdinigraphql.com'
			)} (📄 Doc, ⭐ Github, 📣 Discord, ...)
`
		)
	)
)
