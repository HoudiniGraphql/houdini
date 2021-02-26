// external imports
import { testConfig } from 'houdini-common'
import fs from 'fs/promises'
// local imports
import { runPipeline } from '../../compile'
// the config to use in tests
const config = testConfig()

test('generates runtime without documents', async function () {
	// execute the generator
	await runPipeline(config, [])

	// look up the files in the artifact directory
	const files = await fs.readdir(config.runtimeDirectory)

	// and they have the right names
	expect(files.length).toBeGreaterThan(0)
})
