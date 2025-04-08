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
		`"5ba2c5763a93559769c84d7dd536becf80b4c7be6db9f6af232a4309ebff665c"`
	)
	expect(docs[1].artifact?.hash).toMatchInlineSnapshot(
		`"3dd79e8e7d952e1ba8ee1d50a64c6a050810247ac2af56f9d310749f7d51fe1e"`
	)
	// we don't really care about fragment hashes (but let's keep this)
	expect(docs[2].artifact?.hash).toMatchInlineSnapshot(
		`"084581b5154b8485bdbac1f29137b551205bf1ca4eca635a84199e16cbceb5f1"`
	)
	expect(docs[3].artifact?.hash).toMatchInlineSnapshot(
		`"f97dc26fb608bc65615987c24e4dd594bb52bf34b7bfa934d042f90941756a60"`
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
	expect(operations[docs[0].artifact?.hash ?? 'NOT GOOD']).toMatchInlineSnapshot(`
		"query TestQuery1 {
		  version
		}"
	`)

	expect(operations[docs[1].artifact?.hash ?? 'NOT GOOD']).toMatchInlineSnapshot(`
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
		}"
	`)

	expect(operations[docs[3].artifact?.hash ?? 'NOT GOOD']).toMatchInlineSnapshot(`
		"mutation Add {
		  addFriend {
		    friend {
		      firstName
		      id
		    }
		  }
		}"
	`)
})
