import { HoudiniClient } from '$houdini/runtime'
import * as React from 'react'

export const HoudiniContext = React.createContext<HoudiniClient | null>(null)

export const HoudiniProvider = ({
	client,
	children,
}: {
	client: HoudiniClient
	children: React.ReactNode
}) => <HoudiniContext.Provider value={client}>{children}</HoudiniContext.Provider>
