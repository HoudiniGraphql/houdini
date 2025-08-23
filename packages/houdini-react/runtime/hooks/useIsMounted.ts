import { useRef, useEffect } from 'react'

export function useIsMountedRef(): { current: boolean } {
	const isMountedRef = useRef(true)

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	return isMountedRef
}
