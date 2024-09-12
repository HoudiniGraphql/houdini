import type { PageProps } from './$types'

export default function ({}: PageProps) {
	return (
		<div className="flex flex-col gap-8">
			<h2>Home</h2>

			<p>
				Visit <a href="https://houdinigraphql.com/">Houdini Graphql</a> to read the doc.
			</p>
		</div>
	)
}
