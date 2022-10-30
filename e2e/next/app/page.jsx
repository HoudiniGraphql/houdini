import { graphql, useQuery } from '$houdini'
import React from 'react'

export default function Home() {
	const [data] = useQuery(
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
