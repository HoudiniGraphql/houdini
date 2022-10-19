import os from 'os'
import path from 'path'

// this package is meant to enforce posix conventions whenever
// performing path-related tasks since in general we don't actually
// want to consider the windows conventions. Those situations that _do_
// care will have the necessary logic to turn the posix path into one
// thats appropriate for windows

// sep is always the posix one given ^
export const sep = '/'

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

export function isAbsolute(target: string): boolean {
	return path.isAbsolute(target)
}

export function parse(target: string) {
	return path.parse(target)
}

export const posixify = (str: string) => str.replace(/\\/g, '/')

export function importPath(target: string): string {
	return ['win32', 'win64'].includes(os.platform()) ? 'file:///' + target : target
}
