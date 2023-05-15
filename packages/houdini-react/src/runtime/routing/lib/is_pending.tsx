import { PendingValue } from '$houdini/runtime/lib/types'

export function isPending(value: any): value is PendingValue {
	return typeof value === 'symbol'
}
