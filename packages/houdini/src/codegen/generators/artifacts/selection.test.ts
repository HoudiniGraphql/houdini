import * as graphql from 'graphql'
import { test, expect } from 'vitest'

import { mockCollectedDoc, testConfig } from '../../../test'
import { flattenSelections } from '../../utils'
import selection from './selection'

test('fragments of unions inject correctly', function () {
	const document = graphql.parse(`
        query { 
            entities {
                ...EntityInfo
            }
        }

        fragment EntityInfo on Entity { 
            ... on User { 
                firstName
            }
            ... on Cat { 
                name
            }
        }
    `)

	const config = testConfig()
	const fragmentDefinitions = {
		EntityInfo: document.definitions.find(
			(def): def is graphql.FragmentDefinitionNode => def.kind === 'FragmentDefinition'
		)!,
	}

	const flat = flattenSelections({
		config,
		filepath: '',
		selections: document.definitions.find(
			(def): def is graphql.OperationDefinitionNode => def.kind === 'OperationDefinition'
		)!.selectionSet.selections,
		fragmentDefinitions,
		ignoreMaskDisable: true,
		applyFragments: true,
	})

	const artifactSelection = selection({
		config,
		filepath: '',
		rootType: 'Query',
		operations: {},
		selections: flat,
		includeFragments: false,
		document: mockCollectedDoc(`
        query Query { 
            entities {
                ...EntityInfo
            }
        }`),
	})

	expect(artifactSelection).toMatchInlineSnapshot(`
		{
		    "fields": {
		        "entities": {
		            "type": "Entity",
		            "keyRaw": "entities",
		            "selection": {
		                "abstractFields": {
		                    "fields": {
		                        "User": {
		                            "firstName": {
		                                "type": "String",
		                                "keyRaw": "firstName"
		                            }
		                        },
		                        "Cat": {
		                            "name": {
		                                "type": "String",
		                                "keyRaw": "name"
		                            }
		                        }
		                    },
		                    "typeMap": {}
		                }
		            },
		            "abstract": true
		        }
		    }
		}
	`)
})
