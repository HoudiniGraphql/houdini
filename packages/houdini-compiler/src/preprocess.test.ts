describe('fragment selector', function () {
	// define the test cases
	const table = [
		[
			'flat object',
			`fragment foo on User {
                name
                age
            }`,
			`function(root) {
                return {
                    __ref: root,
                    name: root.name,
                    age: root.age,
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
			`function(root) {
                return {
                    __ref: root,
                    name: root.name,
                    age: root.age,
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
			`function(root) {
                return {
                    __ref: root,
                    name: root.name,
                    parent: {
                        __ref: root.parent,
                        name: root.parent.name
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
			`function(root) {
                return {
                    __ref: root,
                    name: root.name,
                    friends: root.friends.map(obj_root_friends => ({
                        __ref: obj_root_friends,
                        name: obj_root_friends.name,
                        age: obj_root_friends.age
                    }))
                }
            }`,
		],
	]

	for (const [title, fragment, expectedFunction] of table) {
		// run the tests
		test(title, function () {
			//
		})
	}
})
