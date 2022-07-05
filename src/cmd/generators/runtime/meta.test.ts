// external imports
import fs from 'fs/promises'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'

test('generates runtime meta data file', async function () {
	const config = testConfig({ framework: 'sapper', module: 'commonjs' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(config.metaFilePath, 'utf-8')

	expect(fileContents).toBeTruthy()
	// verify contents
	expect(fileContents).toMatchInlineSnapshot(`"{\\"version\\":\\"HOUDINI_VERSION\\"}"`)
})
