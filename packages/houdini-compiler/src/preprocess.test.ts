import * as graphql from 'graphql'
import * as recast from 'recast'
import { FragmentDocumentKind } from './compile'
import { fragmentSelector } from './preprocessor'

describe('fragment selector', function () {
	// define the test cases
	const table = [
		[
			'flat object',
			`fragment foo on User {
                name
                age
            }`,
			`obj => {
    return {
        __ref: obj,
        name: obj.name,
        age: obj.age,
    }
}`,
		],
		[
			'inline fragments',
			`fragment foo on User {
                name
                ... on User {
                    age
                }
            }`,
			`obj => {
    return {
        __ref: obj,
        name: obj.name,
        age: obj.age,
    }
}`,
		],
		[
			'nested objects',
			`fragment foo on User {
                name
                parent {
                    name
                    age
                }
            }`,
			`obj => {
    return {
        __ref: obj,
        name: obj.name,
        parent: {
            __ref: obj.parent,
            name: obj.parent.name
        }
    }
}`,
		],
		[
			'related lists',
			`fragment foo on User {
                name
                friends {
                    name
                    age
                }
            }`,
			`obj => {
    return {
        __ref: obj,
        name: obj.name,
        friends: obj.friends.map(obj_friends => ({
            __ref: obj_friends,
            name: obj_friends.name,
            age: obj_friends.age
        }))
    }
}`,
		],
	]

	for (const [title, fragment, expectedFunction] of table) {
		// run the tests
		test(title, function () {
			// parse the fragment
			const parsedFragment = graphql.parse(fragment)
				.definitions[0] as graphql.FragmentDefinitionNode

			// get the expected selector
			const expected = recast.parse(expectedFunction, {
				parser: require('recast/parsers/typescript'),
			}).program.body[0].expression

			// generate the selector
			const selector = fragmentSelector(
				{
					name: 'asdf',
					kind: FragmentDocumentKind,
				},
				parsedFragment
			).value

			// make sure that both print the same way
			expect(recast.print(selector).code).toBe(recast.print(expected).code)
		})
	}
})
