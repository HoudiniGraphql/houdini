export default function ({ Hello }) {
	return (
		<div className="flex flex-col gap-8">
			<h2>Home</h2>

			<p>{Hello.message}</p>
		</div>
	)
}
