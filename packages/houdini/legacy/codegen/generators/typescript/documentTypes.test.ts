import * as recast from 'recast'
import * as typescriptParser from 'recast/parsers/typescript'
import { expect, test } from 'vitest'

import { runPipeline } from '../..'
import { fs } from '../../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

const config = testConfig({
	schema: })

test('generate document types', async function () {
	const fragmentArtifactContents = await fs.readFile(
		config.artifactTypePath(documents[1].document)
	)

	expect(recast.parse(fragmentArtifactContents!, { parser: typescriptParser }))
		.toMatchInlineSnapshot(`
			import { MyEnum } from "$houdini/graphql/enums";
			import type { ValueOf } from "$houdini/runtime/lib/types";
			export type otherInfo$input = {};

			export type otherInfo = {
			    readonly "shape"?: otherInfo$data;
			    readonly " $fragments": {
			        "otherInfo": any;
			    };
			};

			export type otherInfo$data = {
			    /**
			     * An enum value
			    */
			    readonly enumValue: ValueOf<typeof MyEnum> | null;
			    readonly age: number | null;
			    /**
			     * The user's first name
			     * @deprecated Use firstName instead
			    */
			    readonly firstname: string;
			};

			export type otherInfo$artifact = {
			    "name": "otherInfo";
			    "kind": "HoudiniFragment";
			    "hash": "ea797186970659edb8c7a021812ce5652a9fb1d4ca5f6b9acde4e0aa734e0a3e";
			    "raw": \`fragment otherInfo on User {
			  enumValue
			  age
			  firstname
			  id
			  __typename
			}
			\`;
			    "rootType": "User";
			    "stripVariables": [];
			    "selection": {
			        "fields": {
			            "enumValue": {
			                "type": "MyEnum";
			                "keyRaw": "enumValue";
			                "nullable": true;
			                "visible": true;
			            };
			            "age": {
			                "type": "Int";
			                "keyRaw": "age";
			                "nullable": true;
			                "visible": true;
			            };
			            "firstname": {
			                "type": "String";
			                "keyRaw": "firstname";
			                "visible": true;
			            };
			            "id": {
			                "type": "ID";
			                "keyRaw": "id";
			                "visible": true;
			            };
			            "__typename": {
			                "type": "String";
			                "keyRaw": "__typename";
			                "visible": true;
			            };
			        };
			    };
			    "pluginData": {};
			};
		`)
})
