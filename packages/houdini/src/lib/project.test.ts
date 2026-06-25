import { test, expect, describe, afterEach } from 'vitest'

import { load_vite_env } from './project.js'

// read_config_file substitutes import.meta.env into houdini.config (so a remote-api `url` can be
// env-switched in both a Vite run and plain-node `houdini generate`). The security-critical part is
// WHICH vars get exposed: the config is also bundled into the client, so only the VITE_ prefix may
// leak through — never the rest of process.env. load_vite_env owns that boundary, so we test it
// directly. (The full transform+import path can't be exercised under vitest, which is memfs-backed
// and supplies its own import.meta.env; it's the real-fs `generate` path that runs it.)

afterEach(() => {
	delete process.env.VITE_API_URL
	delete process.env.SECRET_TOKEN
})

describe('load_vite_env (config env exposure)', () => {
	test('exposes VITE_-prefixed vars from the environment', async () => {
		process.env.VITE_API_URL = 'https://api.example.com/graphql'
		const env = await load_vite_env('/proj/houdini.config.js')
		expect(env.VITE_API_URL).toBe('https://api.example.com/graphql')
	})

	test('does NOT expose non-VITE vars (no server secret reaches the client bundle)', async () => {
		process.env.SECRET_TOKEN = 'do-not-leak'
		const env = await load_vite_env('/proj/houdini.config.js')
		expect(env.SECRET_TOKEN).toBeUndefined()
		expect('SECRET_TOKEN' in env).toBe(false)
	})

	test('returns nothing for the prefix when no VITE_ vars are set', async () => {
		const env = await load_vite_env('/proj/houdini.config.js')
		expect(Object.keys(env).some((k) => k.startsWith('VITE_'))).toBe(false)
	})
})
