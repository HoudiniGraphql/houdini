import React, { useTransition } from 'react'

import { useNavigationContext } from './Router'

export function Link({
	href,
	children,
	style,
	...props
}: {
	href: string
	children: React.ReactNode
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
	// grab the router context
	const { goto } = useNavigationContext()

	// the route navigation needs to happen in a transition
	const [pending, startTransition] = useTransition()

	// the click handler for the link needs to navigate to the page
	// as a transition
	const click = (e: React.SyntheticEvent) => {
		e.preventDefault()
		startTransition(() => {
			goto(href)
		})
	}

	return (
		<a href={href} onClick={click} style={style} {...props}>
			{children}
		</a>
	)
}
