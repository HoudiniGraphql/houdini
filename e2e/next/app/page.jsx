import React, { use } from 'react'

export default function Home() {
	const foo = use(
		graphql(`
			query MyQuery {
				viewer {
					id
				}
			}
		`)
	)

	return <div>{foo.name}</div>
}
