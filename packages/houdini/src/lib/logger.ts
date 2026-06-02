import { LogLevel } from './types.js'

const LEVEL_ORDER: Record<string, number> = {
	quiet: 0,
	'short-summary': 1,
	summary: 2,
	full: 3,
}

export class Logger {
	private timers = new Map<string, number>()
	private order: number

	constructor(public readonly level: string = LogLevel.Summary) {
		this.order = LEVEL_ORDER[level] ?? 1
	}

	error(msg: string, ...args: unknown[]) {
		console.error(msg, ...args)
	}

	warn(msg: string, ...args: unknown[]) {
		console.warn(msg, ...args)
	}

	info(msg: string, minLevel: string = LogLevel.Summary) {
		if (this.order >= (LEVEL_ORDER[minLevel] ?? 1)) {
			console.log(msg)
		}
	}

	time(label: string) {
		this.timers.set(label, performance.now())
	}

	timeEnd(label: string, minLevel: string) {
		const start = this.timers.get(label)
		if (start === undefined) return
		this.timers.delete(label)
		if (this.order >= (LEVEL_ORDER[minLevel] ?? 1)) {
			const ms = (performance.now() - start).toFixed(1)
			console.log(`  ${label}: ${ms}ms`)
		}
	}

	at(minLevel: string): boolean {
		return this.order >= (LEVEL_ORDER[minLevel] ?? 1)
	}
}
