import { Log, logCyan, logGreen, logMagneta, logRed } from '@kitql/helper'
import { spawn } from 'child_process'
import micromatch from 'micromatch'
import { Plugin } from 'vite'

function getArraysIntersection(a1: readonly any[], a2: readonly any[]) {
	return a1.filter((n) => {
		return a2.includes(n)
	})
}

export type Options = {
	/**
	 * watch files to trigger the run action (glob format)
	 */
	watch?: string | (() => Promise<string>)
	/**
	 * Kind of watch that will trigger the run action
	 */
	watchKind?: WatchKind[]
	/**
	 * run command (yarn gen for example!)
	 */
	run: string
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
	run: string
	delay: number
	isRunning: boolean
	name?: string | null
}

async function checkConf(params: Options[]) {
	if (!Array.isArray(params)) {
		throw new Error('plugin watchAndRun, `params` needs to be an array.')
	}

	const paramsChecked: Record<string, StateDetail> = {}

	for (const param of params) {
		if (!param.watch) {
			continue
		}

		// watch can be a function or a string
		const watch = typeof param.watch === 'function' ? await param.watch() : param.watch
		paramsChecked[watch] = {
			kind: param.watchKind ?? ['add', 'change', 'unlink'],
			run: param.run,
			delay: param.delay ?? 300,
			isRunning: false,
			name: param.name,
		}

		if (
			!param.watch &&
			getArraysIntersection(paramsChecked[param.watch].kind, kindWithPath).length !== 0
		) {
			throw new Error('plugin watch-and-run, `watch` is missing.')
		}
		if (!param.run) {
			throw new Error('plugin watch-and-run, `run` is missing.')
		}

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore (because the config is in a js file, and people maybe didn't update their config.)
		if (['ADD', 'CHANGE', 'DELETE'].includes(param.watchKind || '')) {
			throw new Error(
				'BREAKING: ADD, CHANGE, DELETE were renamed add, change, unlink. Please update your config.'
			)
		}
	}

	return paramsChecked
}

type ShouldRunResult =
	| { shouldRun: true; globToWatch: string; param: StateDetail }
	| { shouldRun: false; globToWatch: null; param: null }
function shouldRun(
	absolutePath: string | null,
	watchKind: WatchKind,
	watchAndRunConf: Record<string, StateDetail>
): ShouldRunResult {
	for (const [globToWatch, param] of Object.entries(watchAndRunConf)) {
		const isWatched = param.kind.includes(watchKind)
		const isPathMatching = absolutePath && micromatch.isMatch(absolutePath, globToWatch)
		const isWatchKindWithoutPath = kindWithoutPath.includes(watchKind as KindWithoutPath)
		if (!param.isRunning && isWatched && (isPathMatching || isWatchKindWithoutPath)) {
			return {
				shouldRun: true,
				globToWatch,
				param,
			}
		}
	}
	return {
		shouldRun: false,
		globToWatch: null,
		param: null,
	}
}

function formatLog(str: string, name?: string) {
	return `${name ? logMagneta(`[${name}]`) : ''} ${str}`
}

async function watcher(
	absolutePath: string | null,
	watchKind: WatchKind,
	watchAndRunConf: Record<string, StateDetail>
) {
	const shouldRunInfo = shouldRun(absolutePath, watchKind, watchAndRunConf)
	if (shouldRunInfo.shouldRun) {
		watchAndRunConf[shouldRunInfo.globToWatch].isRunning = true

		if (shouldRunInfo.globToWatch) {
			log.info(
				`${logGreen('✔')} Watch ${logCyan(watchKind)}${
					absolutePath && logGreen(' ' + absolutePath)
				}` +
					` and run ${logGreen(shouldRunInfo.param.run)} (+${logCyan(
						shouldRunInfo.param.delay + 'ms'
					)}).`
			)
		} else {
			log.info(
				`${logGreen('✔')} Watch ${logCyan(watchKind)}` +
					` and run ${logGreen(shouldRunInfo.param.run)} (+${logCyan(
						shouldRunInfo.param.delay + 'ms'
					)}).`
			)
		}

		// Run after a delay
		setTimeout(() => {
			const child = spawn(shouldRunInfo.param.run, [], { shell: true })

			//spit stdout to screen
			child.stdout.on('data', (data) => {
				process.stdout.write(formatLog(data.toString(), shouldRunInfo.param.name ?? ''))
			})

			//spit stderr to screen
			child.stderr.on('data', (data) => {
				process.stdout.write(formatLog(data.toString(), shouldRunInfo.param.name ?? ''))
			})

			child.on('close', (code) => {
				if (code === 0) {
					log.info(`${logGreen('✔')} finished ${logGreen('successfully')}`)
				} else {
					log.error(`finished with some ${logRed('errors')}`)
				}
				shouldRunInfo.param.isRunning = false
			})

			return
		}, shouldRunInfo.param.delay)
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
