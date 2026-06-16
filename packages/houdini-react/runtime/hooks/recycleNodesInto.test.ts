import { describe, test, expect } from 'vitest'
import { recycleNodesInto } from './recycleNodesInto.js'

describe('recycleNodesInto', () => {
	test('preserves object identity for unchanged subtrees', () => {
		const a = { id: '1', name: 'Alice' }
		const prev = [a]
		const next = [{ id: '1', name: 'Alice' }]
		const result = recycleNodesInto(prev, next)
		expect(result).toBe(prev)
		expect((result as any[])[0]).toBe(a)
	})

	test('returns new array when element changes', () => {
		const prev = [{ id: '1', name: 'Alice' }]
		const next = [{ id: '1', name: 'Bob' }]
		const result = recycleNodesInto(prev, next)
		expect(result).not.toBe(prev)
	})

	test('copies non-index properties from next when array length changes', () => {
		const prev = [{ id: '1' }] as any[]
		;(prev as any).__id = 'root::MyList'
		const next = [{ id: '1' }, { id: '2' }] as any[]
		;(next as any).__id = 'root::MyList'

		const result = recycleNodesInto(prev, next) as any[]
		expect(result.length).toBe(2)
		expect((result as any).__id).toBe('root::MyList')
	})

	test('copies non-index properties from next when element changes', () => {
		const prev = [{ id: '1', name: 'Alice' }] as any[]
		;(prev as any).__id = 'root::MyList'
		const next = [{ id: '1', name: 'Bob' }] as any[]
		;(next as any).__id = 'root::MyList'

		const result = recycleNodesInto(prev, next) as any[]
		expect((result as any).__id).toBe('root::MyList')
	})

	test('returns prev (with its own properties) when array is unchanged', () => {
		const prev = [{ id: '1' }] as any[]
		;(prev as any).__id = 'root::MyList'
		const next = [{ id: '1' }] as any[]
		;(next as any).__id = 'root::MyList'

		const result = recycleNodesInto(prev, next) as any[]
		expect(result).toBe(prev)
		expect((result as any).__id).toBe('root::MyList')
	})

	test('first render (prev null) returns next with its properties', () => {
		const next = [{ id: '1' }] as any[]
		;(next as any).__id = 'root::MyList'

		const result = recycleNodesInto(null, next) as any[]
		expect(result).toBe(next)
		expect((result as any).__id).toBe('root::MyList')
	})
})
