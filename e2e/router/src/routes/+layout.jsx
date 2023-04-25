import { Link } from '$houdini'

export default function ({ children }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'row' }}>
			<ul>
				<li>
					<Link href="/">Home</Link>
				</li>
				<li>
					<Link href="/users/1">User 1</Link>
				</li>
				<li>
					<Link href="/users/2">User 2</Link>
				</li>
				<li>
					<Link href="/users/3">User 3</Link>
				</li>
			</ul>
			<div>{children}</div>
		</div>
	)
}
