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
        "__ref": obj._ref,
        "name": obj._ref.name,
        "age": obj._ref.age
    };
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
        "__ref": obj._ref,
        "name": obj._ref.name,
        "age": obj._ref.age
    };
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
        "__ref": obj._ref,
        "name": obj._ref.name,
        "parent": {
            "__ref": obj._ref.parent,
            "name": obj._ref.parent.name
        }
    };
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
        "__ref": obj._ref,
        "name": obj._ref.name,
        friends: obj._ref.friends.map(obj_friends => ({
            "__ref": obj_friends._ref,
            "name": obj_friends._ref.name,
            "age": obj_friends._ref.age
        }))
    };
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
