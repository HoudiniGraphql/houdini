import fs from 'node:fs'
import path from 'node:path'
import { expect } from 'vitest'
import addon from '../src/index.js'
import { setupTest } from './setup/suite.js'

// set to true to enable browser testing
const browser = false

const { test, testCases } = setupTest(
	{ addon },
	{
		kinds: [
			{
				type: 'remote',
				options: {
					[addon.id]: {
						is_remote_endpoint: true,
						remote_endpoint: 'http://localhost:4000/graphql',
					},
				},
			},
			{
				type: 'local',
				options: {
					[addon.id]: {
						is_remote_endpoint: false,
						local_schema: './schema.graphql',
					},
				},
			},
		],
		filter: (testCase) => testCase.variant.includes('kit'),
		browser,
	}
)

test.concurrent.for(testCases)('@houdinigraphql/sv $kind.type $variant', async (testCase, {
	page,
	...ctx
}) => {
	const cwd = ctx.cwd(testCase)

	// Check houdini config
	const configPath = path.resolve(cwd, 'houdini.config.js')
	const configContent = fs.readFileSync(configPath, 'utf8')

	if (testCase.kind.type === 'remote') {
		expect(configContent).toContain('watchSchema')
		expect(configContent).toContain('http://localhost:4000/graphql')
	} else if (testCase.kind.type === 'local') {
		expect(configContent).toContain('schemaPath')
		expect(configContent).toContain('./schema.graphql')
	}

	// Check houdini client file (could be .ts or .js)
	// houdini client could be js or ts
	const houdiniClient = ['src/client.ts', 'src/client.js']
		.map((name) => path.resolve(cwd, name))
		.find((file) => fs.existsSync(file))!

	if (testCase.kind.type === 'node') {
		expect(fs.readFileSync(houdiniClient, 'utf8')).toContain('export default new HoudiniClient')
	}

	// Check gitignore contains `.houdini`
	const ignorePath = path.resolve(cwd, '.gitignore')
	const content = fs.readFileSync(ignorePath, 'utf8')
	expect(content).toContain('.houdini')

	// Check vite config is correct
	const viteConfigPath = ['vite.config.ts', 'vite.config.js']
		.map((name) => path.resolve(cwd, name))
		.find((file) => fs.existsSync(file))!
	const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8')

	// Ensure import is added
	expect(viteConfigContent).toMatch(/import houdini from ['"]houdini\/vite['"]/)

	// Check that `houdini()` is added before `sveltekit()` in the array
  const pluginsArrayIdx = viteConfigContent.indexOf("plugins: [");
  // We must have a plugins array in the vite config
  expect(pluginsArrayIdx).toBeGreaterThanOrEqual(0);

  const houdiniConfigIdx = viteConfigContent.indexOf('houdini(),');
  const sveltekitConfigIdx = viteConfigContent.indexOf("sveltekit({");

  // Expect the following order: pluginsArrayIdx < houdiniConfigIdx < sveltekitConfigIdx
  expect(pluginsArrayIdx).toBeLessThan(houdiniConfigIdx);
  expect(houdiniConfigIdx).toBeLessThan(sveltekitConfigIdx);

  // Check that the $houdini alias is added.
  expect(viteConfigContent).toMatch(/\$houdini: ['"]\.houdini\/['"]/)
})
