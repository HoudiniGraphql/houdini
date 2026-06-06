import { Outlet, HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { getContent } from '../lib/content'
import { TutorialProvider } from '../lib/TutorialProvider'
import '../index.css'

export const Route = createRootRoute({
	notFoundComponent: () => null,
	loader: () => getContent(),
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'Houdini Tutorial' },
		],
	}),
	component: function Root() {
		const content = Route.useLoaderData()
		return (
			<html lang="en">
				<head>
					<HeadContent />
				</head>
				<body>
					<TutorialProvider content={content}>
						<Outlet />
					</TutorialProvider>
					<Scripts />
				</body>
			</html>
		)
	},
})
