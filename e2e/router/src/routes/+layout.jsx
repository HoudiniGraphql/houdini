import { Link } from '$houdini'

export default function ({ HelloRouter, children }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
			<div>{children}</div>
			message: {HelloRouter.message}
			<ul>
				<li>
					<Link href="/">Home</Link>
				</li>
				<li>
					<Link href="/users/1">Bruce Willis</Link>
				</li>
				<li>
					<Link href="/users/2">Samuel Jackson</Link>
				</li>
				<li>
					<Link href="/users/3">Morgan Freeman</Link>
				</li>
			</ul>
		</div>
	)
}
