import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Logger } from './logger.js'
import { LogLevel } from './types.js'

describe('Logger', () => {
	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {})
		vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('info level gating', () => {
		test('prints when level matches', () => {
			const log = new Logger(LogLevel.Summary)
			log.info('hello', LogLevel.Summary)
			expect(console.log).toHaveBeenCalledWith('hello')
		})

		test('prints when logger level exceeds minLevel', () => {
			const log = new Logger(LogLevel.Verbose)
			log.info('hello', LogLevel.ShortSummary)
			expect(console.log).toHaveBeenCalledWith('hello')
		})

		test('suppresses when logger level is below minLevel', () => {
			const log = new Logger(LogLevel.Summary)
			log.info('hello', LogLevel.Verbose)
			expect(console.log).not.toHaveBeenCalled()
		})

		test('quiet level suppresses summary messages', () => {
			const log = new Logger(LogLevel.Quiet)
			log.info('hello', LogLevel.Summary)
			expect(console.log).not.toHaveBeenCalled()
		})
	})

	describe('error and warn always print', () => {
		test('error prints regardless of level', () => {
			const log = new Logger(LogLevel.Quiet)
			log.error('boom')
			expect(console.error).toHaveBeenCalledWith('boom')
		})

		test('warn prints regardless of level', () => {
			const log = new Logger(LogLevel.Quiet)
			log.warn('careful')
			expect(console.warn).toHaveBeenCalledWith('careful')
		})
	})

	describe('at', () => {
		test('returns true when level is sufficient', () => {
			const log = new Logger(LogLevel.Summary)
			expect(log.at(LogLevel.Summary)).toBe(true)
			expect(log.at(LogLevel.ShortSummary)).toBe(true) // PluginDetail < Summary
		})

		test('returns false when level is insufficient', () => {
			const log = new Logger(LogLevel.Summary)
			expect(log.at(LogLevel.Verbose)).toBe(false)
		})
	})

	describe('time / timeEnd', () => {
		test('prints elapsed time when level is sufficient', async () => {
			const log = new Logger(LogLevel.Summary)
			log.time('my-label')
			await new Promise((r) => setTimeout(r, 5))
			log.timeEnd('my-label', LogLevel.Summary)

			expect(console.log).toHaveBeenCalledOnce()
			const msg = (console.log as any).mock.calls[0][0] as string
			expect(msg).toMatch(/my-label/)
			expect(msg).toMatch(/ms/)
		})

		test('suppresses elapsed time when level is insufficient', () => {
			const log = new Logger(LogLevel.Quiet)
			log.time('my-label')
			log.timeEnd('my-label', LogLevel.Summary)
			expect(console.log).not.toHaveBeenCalled()
		})

		test('is a no-op timeEnd for unknown label', () => {
			const log = new Logger(LogLevel.Verbose)
			log.timeEnd('never-started', LogLevel.Quiet)
			expect(console.log).not.toHaveBeenCalled()
		})
	})
})
