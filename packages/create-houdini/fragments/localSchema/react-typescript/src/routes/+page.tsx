import { PageProps } from './$types'

export default function ({ HelloHoudini }: PageProps) {
	return (
		<div className="flex flex-col gap-8">
			<h2>Home</h2>

			<p>{HelloHoudini.message}</p>
		</div>
	)
}
