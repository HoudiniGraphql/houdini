import * as graphql from 'graphql'
import * as recast from 'recast'
import { FragmentDocumentKind } from './compile'
import { selector } from './preprocessor'

// declare a schema we will use
const schema = graphql.buildSchema(`
    type User {
        name: String!
        age: Int!
        parent: User!
        friends: [User!]!
    }
`)

const config = {
	artifactDirectory: 'TODO',
	artifactDirectoryAlias: 'TODO',
	schema,
}

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
        "__ref": obj.__ref,
        "name": obj.__ref.name,
        "age": obj.__ref.age
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
        "__ref": obj.__ref.,
        "name": obj.__ref.name,
        "age": obj.__ref.age
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
        "__ref": obj.__ref.,
        "name": obj.__ref.name,
        "parent": {
            "__ref": obj.__ref.parent,
            "name": obj.__ref.parent.name
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
        "__ref": obj.__ref.,
        "name": obj.__ref.name,
        friends: obj.__ref.friends.map(obj_friends => {
            return {
                "__ref": obj_friends.__ref,
                "name": obj_friends.__ref.name,
                "age": obj_friends.__ref.age
            }
        })
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
			const result = selector(
				'obj',
				config,
				{ name: 'testFragment', kind: FragmentDocumentKind },
				parsedFragment
			)

			// make sure that both print the same way
			expect(recast.print(result).code).toBe(recast.print(expected).code)
		})
	}
})
