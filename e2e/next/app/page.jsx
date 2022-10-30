import { query } from '$houdini'
import React, { use } from 'react'

export default async function Home() {
	const [data] = await query(`
		query MyData {
			user(id: "1", snapshot: "hello-react") {
				name
			}
		}
	`)

	console.log(data)

	return <div>{JSON.stringify(data)}</div>
}
