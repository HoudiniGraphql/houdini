export function getGlobalVariable<T>(key: string, defaultValue: T): T {
	globalThis.__react_streaming = globalThis.__react_streaming || {}
	globalThis.__react_streaming[key] = globalThis.__react_streaming[key] || defaultValue
	return globalThis.__react_streaming[key] as T
}
declare global {
	var __react_streaming: Record<string, any>
}
