import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs } from '../../../lib'
import { mockCollectedDoc } from '../../../test'
import { config } from './typescript.test'

test('@loading on fragment - happy path', async function () {
	const docs = [
		mockCollectedDoc(`
			fragment UserBase on User {
				id
				firstName @loading
				parent @loading { 
					id @loading
					parent @loading { 
						id
					}
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const fragmentFileContents = await fs.readFile(config.artifactTypePath(docs[0].document))

	expect(
		recast.parse(fragmentFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export type UserBase$input = {};

		export type UserBase = {
		    readonly "shape"?: UserBase$data;
		    readonly " $fragments": {
		        "UserBase": any;
		    };
		};

		export type UserBase$data = {
		    readonly id: string;
		    readonly firstName: string;
		    readonly parent: {
		        readonly id: string;
		        readonly parent: {
		            readonly id: string;
		        } | null;
		    } | null;
		} | never;
	`)
})

test('@loading on query - happy path', async function () {
	const docs = [
		mockCollectedDoc(`
			query UserQuery {
				user(id: "1") @loading {
					firstName @loading
					parent @loading { 
						id @loading
						parent @loading { 
							id
						}
					}
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const fragmentFileContents = await fs.readFile(config.artifactTypePath(docs[0].document))

	expect(
		recast.parse(fragmentFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export type UserQuery = {
		    readonly "input": UserQuery$input;
		    readonly "result": UserQuery$result | undefined;
		};

		export type UserQuery$result = {
		    readonly user: {
		        readonly firstName: string;
		        readonly parent: {
		            readonly id: string;
		            readonly parent: {
		                readonly id: string;
		            } | null;
		        } | null;
		    } | null;
		} | never;

		export type UserQuery$input = null;
	`)
})
