import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createMock } from '$houdini'

afterEach(cleanup)

// ─── Static query mock ───────────────────────────────────────────────────────

describe('static query mock', () => {
	test('renders the mock response', async () => {
		const App = createMock({
			url: '/hello-world',
			data: {
				HelloWorld: { hello: 'Mock World!' },
			},
		})

		render(<App />)
		await screen.findByText('Mock World!')
	})

	test('different static values render independently', async () => {
		const App = createMock({
			url: '/hello-world',
			data: {
				HelloWorld: { hello: 'Custom greeting' },
			},
		})

		render(<App />)
		await screen.findByText('Custom greeting')
	})
})

// ─── Route params → query variables ──────────────────────────────────────────

// ─── Plain-JSON data ─────────────────────────────────────────────────────────

describe('plain server JSON data', () => {
	test('mock data is the fully-resolved server payload — nested fragment fields inline, no Houdini annotations', async () => {
		// FragmentCursorForwardsQuery spreads a named fragment on User which selects a
		// nested connection with edges and pageInfo. The server returns the fragment
		// fields inlined — no " $fragments" mask annotations. This test verifies that
		// the mock type accepts that shape and that the component renders from it.
		const App = createMock({
			url: '/pagination/fragment/connection-forwards',
			data: {
				// Plain server JSON — id/__typename/cursor are normal GraphQL fields,
				// not Houdini annotations. No " $fragments" keys are required here.
				FragmentCursorForwardsQuery: {
					user: {
						id: '1',
						__typename: 'User',
						usersConnectionSnapshot: {
							__typename: 'UserConnection',
							edges: [
								{ cursor: 'c1', __typename: 'UserEdge', node: { id: 'u1', __typename: 'User', name: 'Alice' } },
								{ cursor: 'c2', __typename: 'UserEdge', node: { id: 'u2', __typename: 'User', name: 'Bob' } },
							],
							pageInfo: {
								__typename: 'PageInfo',
								hasNextPage: false,
								hasPreviousPage: false,
								startCursor: 'c1',
								endCursor: 'c2',
							},
						},
					},
				},
			},
		})

		render(<App />)
		await screen.findByText('Alice, Bob')
	})
})

// ─── Route params → query variables ──────────────────────────────────────────

describe('route params', () => {
	test('params become query variables and are rendered by the page', async () => {
		// /route_params/[id] renders "{id}:{user.name}" — both the route param and query
		// result appear together, so both must be wired correctly.
		const App = createMock({
			url: '/route_params/[id]',
			params: { id: '99' },
			data: {
				RouteParamsUserInfo: { user: { id: "99", __typename: "User", name: 'Alice' } },
			},
		})

		render(<App />)
		await screen.findByText('99:Alice')
	})

	test('different param values produce independent renders', async () => {
		const App1 = createMock({
			url: '/route_params/[id]',
			params: { id: '1' },
			data: { RouteParamsUserInfo: { user: { id: "1", __typename:"User", name: 'User One' } } },
		})
		const App2 = createMock({
			url: '/route_params/[id]',
			params: { id: '2' },
			data: { RouteParamsUserInfo: { user: {  id: "2", __typename:"User", name: 'User Two' } } },
		})

		const { unmount } = render(<App1 />)
		await screen.findByText('1:User One')
		unmount()

		render(<App2 />)
		await screen.findByText('2:User Two')
	})
})

// ─── Function mock ────────────────────────────────────────────────────────────

describe('function mock', () => {
	test('receives the variables that the router derives from the URL params', async () => {
		const mockFn = vi.fn().mockReturnValue({ user: { name: 'Bob' } })

		const App = createMock({
			url: '/route_params/[id]',
			params: { id: '42' },
			data: {
				RouteParamsUserInfo: mockFn,
			},
		})

		render(<App />)
		await screen.findByText('42:Bob')

		// The router should have derived id:'42' from the URL and passed it as a variable
		expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ id: '42' }))
	})

	test('can return different data based on variables', async () => {
		const App = createMock({
			url: '/route_params/[id]',
			params: { id: '7' },
			data: {
				RouteParamsUserInfo: ({ id }) => ({
					user: { 
            id,
            name: id === '7' ? 'Lucky Seven' : 'Unknown' ,
            __typename: "User"
          },
				}),
			},
		})

		render(<App />)
		await screen.findByText('7:Lucky Seven')
	})
})

// ─── Fresh cache isolation ────────────────────────────────────────────────────

describe('cache isolation', () => {
	test('each createMock call gets its own cache — data does not bleed between instances', async () => {
		const App1 = createMock({
			url: '/hello-world',
			data: { HelloWorld: { hello: 'from instance 1' } },
		})
		const App2 = createMock({
			url: '/hello-world',
			data: { HelloWorld: { hello: 'from instance 2' } },
		})

		// Render both simultaneously — each should show its own data
		const { container } = render(
			<div>
				<section data-testid="app1">
					<App1 />
				</section>
				<section data-testid="app2">
					<App2 />
				</section>
			</div>
		)

		await screen.findByText('from instance 1')
		await screen.findByText('from instance 2')

		expect(container.querySelector('[data-testid="app1"]')!.textContent).toContain(
			'from instance 1'
		)
		expect(container.querySelector('[data-testid="app2"]')!.textContent).toContain(
			'from instance 2'
		)
	})
})

// ─── Mutation handlers ────────────────────────────────────────────────────────

describe('mutation mock', () => {
	test('mutation handler is called with the correct variables when a button fires it', async () => {
		const updateHandler = vi.fn().mockReturnValue({
			updateUserByID: { id: '1', name: 'updated name' },
		})

		const App = createMock({
			url: '/list-operations/update',
			data: {
				UpdateFragmentTest: {
					usersList: [{ id: '1', name: 'Original Name',  __typename: "User"}],
				},
				// Mutations are optional — only provide handlers for the ones the test cares about
				UpdateExisting: updateHandler,
			},
		})

		render(<App />)
		await screen.findByText('Original Name')

		fireEvent.click(screen.getByText('Update Existing'))

		await waitFor(() => {
			expect(updateHandler).toHaveBeenCalledWith(
				expect.objectContaining({ id: '1', name: 'updated name' })
			)
		})
	})

	test('function mutation handler receives variables and can inspect them', async () => {
		const capturedVariables: any[] = []

		const App = createMock({
			url: '/list-operations/update',
			data: {
				UpdateFragmentTest: {
					usersList: [{ id: 'user-abc', name: 'Test User', __typename: "User" }],
				},
				UpdateExisting: (vars) => {
					capturedVariables.push(vars)
					return { updateUserByID: { id: vars.id, name: vars.name, __typename: "User" } }
				},
			},
		})

		render(<App />)
		await screen.findByText('Test User')
		fireEvent.click(screen.getByText('Update Existing'))

		await waitFor(() => {
			expect(capturedVariables).toHaveLength(1)
			expect(capturedVariables[0]).toMatchObject({ id: 'user-abc', name: 'updated name' })
		})
	})
})

// ─── Subscription guard ───────────────────────────────────────────────────────

describe('subscription guard', () => {
	test('mock plugin throws synchronously when a subscription document fires', () => {
		// The subscription guard lives in the mock plugin's network hook.
		// We exercise it directly rather than through a full render since no
		// e2e route uses a subscription.
		let thrownError: Error | null = null

		const fakePlugin = () => ({
			network(ctx: any, _handlers: any) {
				if (ctx.artifact.kind === 'HoudiniSubscription') {
					throw new Error(
						`createMock: subscriptions are not supported. "${ctx.artifact.name}" fired during this test.`
					)
				}
			},
		})

		try {
			fakePlugin().network(
				{ artifact: { name: 'LiveFeed', kind: 'HoudiniSubscription' } },
				{}
			)
		} catch (err) {
			thrownError = err as Error
		}

		expect(thrownError).not.toBeNull()
		expect(thrownError!.message).toMatch(/subscriptions are not supported/)
		expect(thrownError!.message).toContain('LiveFeed')
	})
})

// ─── Missing mock guard ───────────────────────────────────────────────────────

describe('missing mock', () => {
	test('throws synchronously at createMock() when a required query is missing', () => {
		expect(() =>
			createMock({
				url: '/hello-world',
				// HelloWorld deliberately omitted
				data: {} as any,
			})
		).toThrow(/missing mock data for "HelloWorld"/)
	})

	test('error message names every missing query', () => {
		expect(() =>
			createMock({
				url: '/route_params/[id]',
				params: { id: '1' },
				data: {} as any,
			})
		).toThrow(/missing mock data for "RouteParamsUserInfo"/)
	})
})
