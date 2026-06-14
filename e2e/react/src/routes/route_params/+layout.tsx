import { Link } from '$houdini'

import { LayoutProps } from './$types'

export default ({ children }: LayoutProps) => {
	return (
		<div>
			<div className="flex flex-row gap-12">
				<Link id="user-link-1" to="/route_params/[id]" params={{ id: 1 }}>
					user 1
				</Link>
				<Link id="user-link-2" to="/route_params/[id]" params={{ id: 2 }}>
					user 2
				</Link>
			</div>
			{children}
		</div>
	)
}
