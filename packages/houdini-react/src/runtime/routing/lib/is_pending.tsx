export function isPending(value: any): value is symbol {
	return typeof value === 'symbol'
}
