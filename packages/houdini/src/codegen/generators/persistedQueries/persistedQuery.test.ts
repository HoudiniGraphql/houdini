import { test, expect, beforeEach } from 'vitest'

import { runPipeline } from '../../../codegen'
import type { Config, Document } from '../../../lib'
import { fs, path } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

let config: Config
let docs: Document[]

beforeEach(() => {
	config = testConfig()
	config.persistedQueriesPath = path.join(config.rootDir, 'hash.json')

	// the documents to test
	docs = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { user { ...TestFragment @mask_disable } }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
		mockCollectedDoc(`mutation Add { addFriend { friend { firstName id } } }`),
	]
})

test('Artifact hash values', async function () {
	// execute the generator
	await runPipeline(config, docs)

	// Check if it changed
	expect(docs[0].artifact?.hash).toMatchInlineSnapshot(
		'"361432f464ed44eed788f3ea66c4dabc46437b88edbe7daccca87045fd31447f"'
	)
	expect(docs[1].artifact?.hash).toMatchInlineSnapshot(
		'"7b6df0b58f32c599a8b07d36cdbdc21570f07b4b8a6819ebf457888be98798ad"'
	)
	// we don't really care about fragment hashes (but let's keep this)
	expect(docs[2].artifact?.hash).toMatchInlineSnapshot(
		'"ff694171ced9bd7edc84a4a4a4201dadea30c0cdb8a8734c940872a673111bc1"'
	)
	expect(docs[3].artifact?.hash).toMatchInlineSnapshot(
		'"fe1a99181d15832006212f1d94483733e06a2a73b12ef7a167c980f7f484c2ee"'
	)
})

test('Hash in generated file are found and has a good values', async function () {
	// execute the generator
	await runPipeline(config, docs)

	const operations: Record<string, string> = JSON.parse(
		(await fs.readFile(config.persistedQueriesPath))!
	)

	// we should have only 3 operations (2 queries and 1 mutation)
	expect(Object.keys(operations).length).toBe(3)

	// Let's look add the hashes and make sure they match the expected values
	// And make sure hashs in the file are the same as in artifacts
	expect(operations[docs[0].artifact?.hash!]).toMatchInlineSnapshot(`
		"query TestQuery1 {
		  version
		}
		"
	`)

	expect(operations[docs[1].artifact?.hash!]).toMatchInlineSnapshot(`
			"query TestQuery2 {
			  user {
			    ...TestFragment
			    id
			  }
			}

			fragment TestFragment on User {
			  firstName
			  id
			  __typename
			}
			"
		`)

	expect(operations[docs[3].artifact?.hash!]).toMatchInlineSnapshot(`
		"mutation Add {
		  addFriend {
		    friend {
		      firstName
		      id
		    }
		  }
		}
		"
	`)
})
