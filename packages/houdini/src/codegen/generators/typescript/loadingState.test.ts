import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

const config = testConfig({
	schema: `
		type Query {
			user: User
		}

		type User {
			id: ID!
			firstName: String!
			parent: User
		}
	`,
})

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
		import { LoadingValue } from "$houdini/runtime/lib/types";
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
		} | {
		    readonly firstName: LoadingValue;
		    readonly parent: {
		        readonly id: LoadingValue;
		        readonly parent: LoadingValue;
		    };
		};
	`)
})

test('@loading on query - happy path', async function () {
	const docs = [
		mockCollectedDoc(`
			query UserQuery {
				user @loading {
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
		import { LoadingValue } from "$houdini/runtime/lib/types";

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
		} | {
		    readonly user: {
		        readonly firstName: LoadingValue;
		        readonly parent: {
		            readonly id: LoadingValue;
		            readonly parent: LoadingValue;
		        };
		    };
		};

		export type UserQuery$input = null;
	`)
})
