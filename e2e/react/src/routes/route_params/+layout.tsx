import { LayoutProps } from './$types'

export default ({ children }: LayoutProps) => {
	return (
		<div>
			<div className="flex flex-row gap-12">
				<a href="/route_params/1">user 1</a>
				<a href="/route_params/2">user 2</a>
				<a href="/route_params/3">user 3</a>
			</div>
			{children}
		</div>
	)
}
