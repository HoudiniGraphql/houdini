import * as graphql from 'graphql'
import { test, expect, describe } from 'vitest'

import { testConfig } from '../../test'
import { flattenSelections } from './flattenSelections'

const config = testConfig({ defaultFragmentMasking: 'disable' })

const fragmentDefinitions = (
	graphql.parse(`
	fragment Foo on User {
		id
	}
`).definitions as graphql.FragmentDefinitionNode[]
).reduce(
	(acc, defn) => ({
		...acc,
		[defn.name.value]: defn,
	}),
	{}
)

function getSelections(doc: string): readonly graphql.SelectionNode[] {
	return (graphql.parse(doc).definitions[0] as graphql.OperationDefinitionNode).selectionSet
		.selections
}
function testFlatten(
	doc: string,
	applyFragments: boolean = true,
	hoistFragments: boolean = true
): graphql.OperationDefinitionNode {
	const flat = flattenSelections({
		config,
		filepath: '',
		fragmentDefinitions,
		selections: getSelections(doc),
		applyFragments,
		hoistFragments,
	})

	return {
		kind: 'OperationDefinition',
		operation: 'query',
		selectionSet: { kind: 'SelectionSet', selections: flat },
	}
}

describe('flattenSelection', function () {
	test('applies fragment definitions', function () {
		expect(
			testFlatten(`
				{
					user {
						...Foo
					}
				}
			`)
		).toMatchInlineSnapshot(`
			{
			  user {
			    ... on User {
			      id
			    }
			    ...Foo
			  }
			}
		`)
	})

	test('merges field selections', function () {
		expect(
			testFlatten(`
				{
					user {
						id
					}
					user {
						name
					}
				}
			`)
		).toMatchInlineSnapshot(`
			{
			  user {
			    id
			    name
			  }
			}
		`)
	})

	test('flattens nested inline fragments', function () {
		expect(
			testFlatten(`
				{
					friends {
						... on Friend {
							name
							... on User {
								id
							}
							... on Ghost {
								id
							}
							... on Cat {
								id
							}
						}
						... on Cat {
							name
						}
					}
				}
			`)
		).toMatchInlineSnapshot(`
			{
			  friends {
			    ... on Friend {
			      name
			    }
			    ... on User {
			      id
			    }
			    ... on Ghost {
			      id
			    }
			    ... on Cat {
			      id
			      name
			    }
			  }
			}
		`)
	})

	test('flattens referenced fragments (hoist)', function () {
		expect(
			testFlatten(
				`
				{
					friends {
						... on Friend {
							name
							... Foo
						}
					}
				}
			`
			)
		).toMatchInlineSnapshot(`
			{
			  friends {
			    ... on Friend {
			      name
			    }
			    ... on User {
			      id
			    }
			    ...Foo
			  }
			}
		`)
	})
})
