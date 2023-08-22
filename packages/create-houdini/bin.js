#!/usr/bin/env node
import * as p from '@clack/prompts'
import { execSync } from 'child_process'
import { create as create_svelte } from 'create-svelte'
import { detectTools, finale_logs, init as houdini_init } from 'houdini'
import { green, grey } from 'kleur/colors'
import fs from 'node:fs'
import path from 'node:path'

const { version } = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url), 'utf-8'))
let cwd = process.argv[2] || '.'

console.log(`${grey(`create-houdini version ${version}`)}
`)

p.intro('🎩 Welcome to Houdini!')

// project location
if (cwd === '.') {
	const dir = await p.text({
		message: `What's the project name?`,
		placeholder: '  (a folder with this name will be created)',
		validate: (value) => {
			if (value.length === 0) {
				return 'Please enter a project name'
			}
			return
		},
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

await houdini_init(cwd, {
	check_is_git_clean: false,
	check_is_in_project: false,
	with_intro: false,
	after_questions: async () => {
		const s = p.spinner()
		s.start('Preparing project')
		if (framework === 'react') {
			// rely on network npm create...
			// execSync(`npm create vite@4.4.1 ${project_name} -- --template react-swc-ts`)
			// rely on local npm create...
			execSync(`npm exec create-vite ${project_name} -- --template react-swc-ts`)
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
	},
	with_found_info: false,
	with_outro: false,
	with_finale_logs: false,
})

// Some extra stuff
fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), '')

p.outro('🎉 Everything is ready!')

const { package_manager } = await detectTools(cwd)
finale_logs(package_manager, cwd)
