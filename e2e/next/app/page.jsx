import { graphql } from '$houdini'
import React, { use } from 'react'

export default function Home() {
	const data = use(
		graphql(`
			query MyData {
				user(id: "1", snapshot: "hello-react") {
					name
				}
			}
		`)
	)

	console.log(data)

	return <div>hello</div>
}
