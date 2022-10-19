import path from 'path'

export function resolve(...parts: string[]): string {
	return posixify(path.resolve(...parts))
}

export function join(...parts: string[]): string {
	return posixify(path.join(...parts))
}

export function extname(target: string): string {
	return path.extname(target)
}

export function relative(from: string, to: string): string {
	return posixify(path.relative(from, to))
}

export function basename(target: string): string {
	return path.basename(target)
}

export function dirname(target: string): string {
	return path.dirname(target)
}

export const sep = path.sep

export function isAbsolute(target: string): boolean {
	return path.isAbsolute(target)
}

export function parse(target: string) {
	return path.parse(target)
}

export const posixify = (str: string) => str.replace(/\\/g, '/')
