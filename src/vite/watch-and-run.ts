import { Log, logCyan, logGreen, logMagneta, logRed } from '@kitql/helper'
import { spawn } from 'child_process'
import micromatch from 'micromatch'
import { Plugin } from 'vite'
import { formatErrors } from '../common'

function getArraysIntersection(a1: readonly any[], a2: readonly any[]) {
	return a1.filter((n) => {
		return a2.includes(n)
	})
}

export type Options = {
	/**
	 * watch files to trigger the run action (glob format)
	 */
	watch?: string

	watchFile?: (filepath: string) => Promise<boolean>
	/**
	 * Kind of watch that will trigger the run action
	 */
	watchKind?: WatchKind[]
	/**
	 * Don't print anything extra to the console when an event is trigger
	 */
	quiet?: boolean
	/**
	 * run command (yarn gen for example!)
	 */
	run: string | (() => void | Promise<void>)
	/**
	 * Delay before running the run command (in ms)
	 * @default 300 ms
	 */
	delay?: number | null
	/**
	 * Name to display in the logs as prefix
	 */
	name?: string | null
}

export const kindWithPath = ['add', 'addDir', 'change', 'unlink', 'unlinkDir'] as const
export type KindWithPath = typeof kindWithPath[number]
export const kindWithoutPath = ['all', 'error', 'raw', 'ready'] as const
export type KindWithoutPath = typeof kindWithoutPath[number]
export type WatchKind = KindWithPath | KindWithoutPath

export type StateDetail = {
	kind: WatchKind[]
	quiet: boolean
	run: string | (() => void | Promise<void>)
	delay: number
	isRunning: boolean
	watchFile?: (filepath: string) => boolean | Promise<boolean>
	watch?: string
	name?: string | null
}

async function checkConf(params: Options[]) {
	if (!Array.isArray(params)) {
		throw new Error('plugin watchAndRun, `params` needs to be an array.')
	}

	const paramsChecked: StateDetail[] = []

	for (const param of params) {
		if (!param.watch && !param.watchFile) {
			continue
		}

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore (because the config is in a js file, and people maybe didn't update their config.)
		if (['ADD', 'CHANGE', 'DELETE'].includes(param.watchKind || '')) {
			throw new Error(
				'BREAKING: ADD, CHANGE, DELETE were renamed add, change, unlink. Please update your config.'
			)
		}

		if (!param.watch && !param.watchFile) {
			throw new Error('plugin watch-and-run, `watch` is missing.')
		}
		if (!param.run) {
			throw new Error('plugin watch-and-run, `run` is missing.')
		}

		// watch can be a function or a string
		paramsChecked.push({
			kind: param.watchKind ?? ['add', 'change', 'unlink'],
			run: param.run,
			delay: param.delay ?? 300,
			isRunning: false,
			name: param.name,
			quiet: !!param.quiet,
			watch: param.watch,
			watchFile: param.watchFile,
		})
	}

	return paramsChecked
}

async function shouldRun(
	absolutePath: string | null,
	watchKind: WatchKind,
	watchAndRunConf: StateDetail[]
): Promise<StateDetail | null> {
	for (const info of watchAndRunConf) {
		if (!absolutePath || (!info.watchFile && !info.watch)) {
			continue
		}

		const isWatched = info.kind.includes(watchKind)
		let isPathMatching = false

		if (info.watchFile) {
			isPathMatching = await info.watchFile(absolutePath)
		} else {
			isPathMatching = micromatch.isMatch(absolutePath, info.watch!)
		}

		const isWatchKindWithoutPath = kindWithoutPath.includes(watchKind as KindWithoutPath)
		if (!info.isRunning && isWatched && (isPathMatching || isWatchKindWithoutPath)) {
			return info
		}
	}
	return null
}

function formatLog(str: string, name?: string) {
	return `${name ? logMagneta(`[${name}]`) : ''} ${str}`
}

async function watcher(
	absolutePath: string | null,
	watchKind: WatchKind,
	watchAndRunConf: StateDetail[]
) {
	const info = await shouldRun(absolutePath, watchKind, watchAndRunConf)
	if (info) {
		info.isRunning = true

		// print the message
		if (!info.quiet) {
			let message = `${logGreen('✔')} Watch ${logCyan(watchKind)}`
			if (info.watch && absolutePath) {
				message += logGreen(' ' + absolutePath)
			}
			if (typeof info.run === 'string') {
				message + ` and run ${logGreen(info.run)} `
			}
			message += logCyan(info.delay + 'ms')

			log.info(message)
		}

		// Run after a delay
		setTimeout(async () => {
			// if the run value is a function, we just have to call it and we're done
			if (typeof info.run === 'function') {
				const promise = info.run()
				try {
					if (promise) {
						await promise
					}
				} catch (e) {
					formatErrors(e)
				}
				info.isRunning = false
				return
			}

			const child = spawn(info.run, [], { shell: true })

			//spit stdout to screen
			child.stdout.on('data', (data) => {
				process.stdout.write(formatLog(data.toString(), info.name ?? ''))
			})

			//spit stderr to screen
			child.stderr.on('data', (data) => {
				process.stdout.write(formatLog(data.toString(), info.name ?? ''))
			})

			child.on('close', (code) => {
				if (code === 0) {
					log.info(`${logGreen('✔')} finished ${logGreen('successfully')}`)
				} else {
					log.error(`finished with some ${logRed('errors')}`)
				}
				info.isRunning = false
			})

			return
		}, info.delay)
	}

	return
}

const log = new Log('KitQL Watch-And-Run')

export default function watchAndRun(params: Options[]): Plugin {
	return {
		name: 'watch-and-run',

		async configureServer(server) {
			// check params, throw Errors if not valid and return a new object representing the state of the plugin
			const watchAndRunConf = await checkConf(params)

			kindWithPath.forEach((kind: KindWithPath) => {
				const _watcher = async (absolutePath: string) =>
					watcher(absolutePath, kind, watchAndRunConf)
				server.watcher.on(kind, _watcher)
			})

			kindWithoutPath.forEach((kind: KindWithoutPath) => {
				const _watcher = () => watcher(null, kind, watchAndRunConf)
				server.watcher.on(kind, _watcher)
			})
		},
	}
}
