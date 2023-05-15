import { PendingValue } from '$houdini/runtime/lib/types'

export function isPending(value: any): value is typeof PendingValue {
	return typeof value === 'symbol'
}
