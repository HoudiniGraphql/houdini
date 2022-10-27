import { graphql } from '$houdini'
import React, { use } from 'react'

export default function Home() {
	const [data] = use(
		graphql(`
			query MyQuery {
				viewer {
					id
				}
			}
		`)
	)

	return <div>{data.name}</div>
}
