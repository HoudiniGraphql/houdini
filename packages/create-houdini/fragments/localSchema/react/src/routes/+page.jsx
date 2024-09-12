export default function ({ HelloHoudini }) {
	return (
		<div className="flex flex-col gap-8">
			<h2>Home</h2>

			<p>{HelloHoudini.message}</p>
		</div>
	)
}
