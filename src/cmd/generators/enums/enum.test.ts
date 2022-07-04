// external imports
import path from 'path'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import * as recast from 'recast'
import { ProgramKind } from 'ast-types/gen/kinds'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	mockCollectedDoc(`query TestQuery { version }`),
	mockCollectedDoc(`fragment TestFragment on User { firstName }`),
]

test('generates runtime defintions for each enum', async function () {
	// execute the generator
	await runPipeline(config, [])

	// load the contents of the file
	const queryContents = await fs.readFile(path.join(config.enumRuntimeDefinitionsPath), 'utf-8')
	expect(queryContents).toBeTruthy()
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program

	expect(parsedQuery).toMatchInlineSnapshot()
})
