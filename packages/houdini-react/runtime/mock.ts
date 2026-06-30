import type React from 'react'

export function createMock(_args: {
	url: string
	params: any
	data: any
}): React.ComponentType<{}> {
	throw new Error('createMock: no routes have been generated yet. Run `houdini generate` first.')
}
