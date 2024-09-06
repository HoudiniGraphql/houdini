import { cyan, green, Log, magenta, red } from '@kitql/helpers'
import micromatch from 'micromatch'
import { spawn } from 'node:child_process'
import type { PluginOption, ViteDevServer } from 'vite'

const nbOverlap = (a1: readonly any[], a2: readonly any[]) => {
	return a1.filter((value) => a2?.includes(value)).length
}

export type Options = {
	/**
	 * watch files to trigger the run action (glob format)
	 */
	watch?: string | string[]

	/**
	 * watch files to trigger the run action (function format)
	 */
	watchFile?: (filepath: string) => Promise<boolean>

	/**
	 * Kind of watch that will trigger the run action
	 */
	watchKind?: WatchKind[]

	/**
	 * Tune what you want to print to the console. By default, everything.
	 */
	logs?: LogType[]

	/**
	 * run command (npm run gen for example!)
	 */
	run: string | ((server: ViteDevServer, absolutePath: string | null) => void | Promise<void>)

	/**
	 * Delay before running the run command (in ms)
	 * @default 300 ms
	 */
	delay?: number | null

	/**
	 * Name to display in the logs as prefix
	 */
	name?: string | null

	/**
	 * Add shell option to spawn, set "powershell.exe" for example to use it there.
	 */
	shell?: string | null

	/**
	 * formatErrors instead of throwing an error
	 */
	formatErrors?: (e: unknown, afterError?: (e: Error) => void) => void
}

export const kindWithPath = ['add', 'addDir', 'change', 'unlink', 'unlinkDir'] as const
export type KindWithPath = (typeof kindWithPath)[number]
export type LogType = 'trigger' | 'streamData' | 'streamError' | 'end'
export const kindWithoutPath = ['all', 'error', 'raw', 'ready'] as const
export type KindWithoutPath = (typeof kindWithoutPath)[number]
export type WatchKind = KindWithPath | KindWithoutPath

export type StateDetail = {
	kind: WatchKind[]
	logs: LogType[]
	run: string | ((server: ViteDevServer, absolutePath: string | null) => void | Promise<void>)
	delay: number
	isRunning: boolean
	watchFile?: (filepath: string) => boolean | Promise<boolean>
	watch?: string | string[]
	name?: string | null
	shell: string | boolean
	formatErrors?: (e: unknown, afterError?: (e: Error) => void) => void
}

function checkConf(params: Options[]) {
	if (!Array.isArray(params)) {
		throw new Error('plugin watchAndRun, `params` needs to be an array.')
	}

	const paramsChecked: StateDetail[] = []

	for (const paramRow of params) {
		const param: StateDetail = {
			kind: paramRow.watchKind ?? ['add', 'change', 'unlink'],
			run: paramRow.run,
			delay: paramRow.delay ?? 300,
			isRunning: false,
			name: paramRow.name,
			logs: paramRow.logs ?? (['trigger', 'streamData', 'streamError', 'end'] as LogType[]),
			watch: paramRow.watch,
			shell: paramRow.shell ?? true,
			watchFile: paramRow.watchFile,
			formatErrors: paramRow.formatErrors,
		}

		// @ts-ignore (because the config is in a js file, and people maybe didn't update their config.)
		if (['ADD', 'CHANGE', 'DELETE'].includes(param.kind || '')) {
			throw new Error(
				'BREAKING: ADD, CHANGE, DELETE were renamed add, change, unlink. Please update your config.'
			)
		}

		// If you use a kind that needs a watch, we need to make you you have one watch or watchFile set
		if (nbOverlap(kindWithPath, param.kind) !== 0 && !param.watch && !param.watchFile) {
			throw new Error('plugin watch-and-run, `watch` or `watchFile` is missing.')
		}

		// You need to have a run command
		if (!param.run) {
			throw new Error('plugin watch-and-run, `run` is missing.')
		}

		// watch can be a function or a string
		paramsChecked.push(param)
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
		} else if (info.watch) {
			isPathMatching = micromatch.isMatch(absolutePath, info.watch)
		}

		const isWatchKindWithoutPath = kindWithoutPath.includes(watchKind as KindWithoutPath)
		if (!info.isRunning && isWatched && (isPathMatching || isWatchKindWithoutPath)) {
			return info
		}
	}
	return null
}

function formatLog(str: string, name?: string) {
	return `${name ? magenta(`[${name}]`) : ''} ${str}`
}

async function watcher(
	server: ViteDevServer,
	absolutePath: string | null,
	watchKind: WatchKind,
	watchAndRunConf: StateDetail[]
) {
	const info = await shouldRun(absolutePath, watchKind, watchAndRunConf)
	if (info) {
		info.isRunning = true

		// print the message
		if (info.logs.includes('trigger')) {
			const message = [`Watch ${cyan(watchKind)}`]
			if (info.watch && absolutePath) {
				message.push(green(absolutePath.replaceAll(process.cwd(), '')))
			}
			if (typeof info.run === 'string') {
				message.push(`and run ${green(info.run)}`)
			}
			message.push(`${cyan(info.delay + 'ms')}`)

			log.success(message.join(' '))
		}

		// Run after a delay
		setTimeout(async () => {
			// if the run value is a function, we just have to call it and we're done
			if (typeof info.run === 'function') {
				const promise = info.run(server, absolutePath)
				try {
					if (promise) {
						await promise
					}
				} catch (e) {
					if (info.formatErrors) {
						info.formatErrors(e)
					} else {
						throw e
					}
				}
				info.isRunning = false
				return
			}

			const child = spawn(info.run, [], { shell: info.shell })

			//spit stdout to screen
			if (info.logs.includes('streamData')) {
				child.stdout.on('data', (data) => {
					process.stdout.write(formatLog(data.toString(), info.name ?? ''))
				})
			}

			//spit stderr to screen
			if (info.logs.includes('streamError')) {
				child.stderr.on('data', (data) => {
					process.stdout.write(formatLog(data.toString(), info.name ?? ''))
				})
			}

			child.on('close', (code) => {
				if (info.logs.includes('end')) {
					const message = [`Finished`]
					if (info.name) {
						message.push(`${magenta(info.name)}`)
					}
					if (code === 0) {
						message.push(green('successfully'))
						log.success(message.join(' '))
					} else {
						message.push(`with some ${red('errors')}!`)
						log.error(message.join(' '))
					}
				}
				info.isRunning = false
			})

			return
		}, info.delay)
	}

	return
}

const log = new Log('Watch-and-Run')

export const watchAndRun = (
	params: Options[]
): PluginOption & { getCheckedConf: () => StateDetail[] } => {
	return {
		name: 'watch-and-run',

		// jsut for testing purposes
		getCheckedConf() {
			return checkConf(params)
		},

		async configureServer(server) {
			// check params, throw Errors if not valid and return a new object representing the state of the plugin
			const watchAndRunConf = checkConf(params)

			for (const kind of kindWithPath) {
				const _watcher = async (absolutePath: string) =>
					watcher(server, absolutePath, kind, watchAndRunConf)
				server.watcher.on(kind, _watcher)
			}

			for (const kind of kindWithoutPath) {
				const _watcher = () => watcher(server, null, kind, watchAndRunConf)
				server.watcher.on(kind, _watcher)
			}
		},
	}
}
