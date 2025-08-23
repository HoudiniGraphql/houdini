import { LayoutProps } from './$types'

export default ({ children }: LayoutProps) => {
	return (
		<div>
			<div className="flex flex-row gap-12">
				<a id="user-link-1" href="/route_params/1">
					user 1
				</a>
				<a id="user-link-2" href="/route_params/2">
					user 2
				</a>
			</div>
			{children}
		</div>
	)
}
