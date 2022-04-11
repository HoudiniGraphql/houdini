// external imports
import fs from 'fs/promises'
import path from 'path'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'

test('generates an artifact for every document', async function () {
	const config = testConfig()
	config.persistedQueryPath = path.join(config.rootDir, 'hash.json')

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { user { ...TestFragment } }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]
	// execute the generator
	await runPipeline(config, docs)

	expect(JSON.parse(await fs.readFile(config.persistedQueryPath, 'utf-8')))
		.toMatchInlineSnapshot(`
		{
		    "361432f464ed44eed788f3ea66c4dabc46437b88edbe7daccca87045fd31447f": "query TestQuery1 {\\n  version\\n}\\n",
		    "17f12389123502b3d5d81202d0af249bdf0ec95cea480c9c12501ef627abd463": "query TestQuery2 {\\n  user {\\n    ...TestFragment\\n    id\\n  }\\n}\\n\\nfragment TestFragment on User {\\n  firstName\\n}\\n"
		}
	`)
})
