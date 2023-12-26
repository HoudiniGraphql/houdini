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

	fragment UserDetails_2YMH5n on User @arguments(someParam: {type: "Boolean!"}) {
		id
		name
		friendsConnection {
			edges {
				node {
					...FriendInfo_2YMH5n @with(someParam: $someParam)
					id
				}
			}
		}
		__typename
	}

	fragment FriendInfo_2YMH5n on User @arguments(someParam: {type: "Boolean!"}) {
		id
		name
		testField(someParam: $someParam)
		__typename
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
function testFlatten(doc: string, applyFragments: boolean = true): graphql.OperationDefinitionNode {
	const flat = flattenSelections({
		config,
		filepath: '',
		fragmentDefinitions,
		selections: getSelections(doc),
		applyFragments,
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

	test('nested fragments', function () {
		expect(
			testFlatten(
				`
				{
					usersConnection(snapshot: "test") {
						edges {
					       	node {
								...UserDetails_2YMH5n @with(someParam: $someParam)
								id
					       	}
						}
					}
				}
			`
			)
		).toMatchInlineSnapshot(`
			{
			  usersConnection(snapshot: "test") {
			    edges {
			      node {
			        ... on User {
			          id
			          name
			          friendsConnection {
			            edges {
			              node {
			                ... on User {
			                  id
			                  name
			                  testField(someParam: $someParam)
			                  __typename
			                }
			                id
			                ...FriendInfo_2YMH5n @with(someParam: $someParam)
			              }
			            }
			          }
			          __typename
			        }
			        id
			        ...UserDetails_2YMH5n @with(someParam: $someParam)
			      }
			    }
			  }
			}
		`)
	})
})
