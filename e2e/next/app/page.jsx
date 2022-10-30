import { query } from '$houdini'
import React from 'react'

export default async function Home() {
	const [data] = await query(/* GraphQL */ `
		query MyData {
			user(id: "1", snapshot: "hello-react") {
				id
				name
			}
		}
	`)

	return <div>{JSON.stringify(data)}</div>
}
