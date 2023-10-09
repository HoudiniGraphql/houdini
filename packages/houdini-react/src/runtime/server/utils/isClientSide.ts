export { isClientSide }

function isClientSide() {
	return typeof window !== 'undefined' && typeof window?.getComputedStyle === 'function'
}
