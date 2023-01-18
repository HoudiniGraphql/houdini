import type * as graphql from 'graphql'
import { expect, test } from 'vitest'

import { testConfig } from '../../test'
import { objectIdentificationSelection } from './objectIdentificationSelection'

test('go to default id', () => {
	const config = testConfig()
	const result = config.keyFieldsForType('User')
	expect(result).toMatchInlineSnapshot(`
		[
		    "id"
		]
	`)
})

test('go to id selection', () => {
	const config = testConfig()
	const result = objectIdentificationSelection(config, {
		name: 'User',
	} as graphql.GraphQLNamedType)
	expect(result).toMatchInlineSnapshot(`
		[
		    {
		        "kind": "Field",
		        "name": {
		            "kind": "Name",
		            "value": "id"
		        }
		    }
		]
	`)
})

test('go to keys of CustomIdType', () => {
	const config = testConfig()
	const result = config.keyFieldsForType('CustomIdType')
	expect(result).toMatchInlineSnapshot(`
		[
		    "foo",
		    "bar"
		]
	`)
})

test('go to keys selection of CustomIdType', () => {
	const config = testConfig()
	const result = objectIdentificationSelection(config, {
		name: 'CustomIdType',
	} as graphql.GraphQLNamedType)
	expect(result).toMatchInlineSnapshot(`
		[
		    {
		        "kind": "Field",
		        "name": {
		            "kind": "Name",
		            "value": "foo"
		        }
		    },
		    {
		        "kind": "Field",
		        "name": {
		            "kind": "Name",
		            "value": "bar"
		        }
		    }
		]
	`)
})
