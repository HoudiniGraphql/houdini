import { createSchema } from 'graphql-yoga'
import { test, expect, describe, vi } from 'vitest'

import { _serverHandler } from './server.js'

// An end-to-end test of the no-JS form path: a native form POST is run through the real
// Yoga server (real coercion → real GraphQL execution → real redirect interpolation), with
// no browser and no client JS involved. This is the path a form takes before/without
// hydration.

const schema = createSchema({
	typeDefs: /* GraphQL */ `
		type Query {
			hello: String
		}
		type User {
			id: ID!
			name: String!
		}
		scalar File
		type Mutation {
			createUser(name: String!): User!
			boom: User!
			uploadAvatar(file: File!): User!
		}
	`,
	resolvers: {
		Mutation: {
			createUser: (_: unknown, { name }: { name: string }) => ({ id: '7', name }),
			boom: () => {
				throw new Error('kaboom')
			},
			// name the user after the uploaded file's contents so the test can prove the
			// file actually made it through the multipart request to the resolver
			uploadAvatar: async (_: unknown, { file }: { file: File }) => ({
				id: '9',
				name: await file.text(),
			}),
		},
	},
})

const createUserArtifact = {
	name: 'CreateUser',
	kind: 'HoudiniMutation',
	raw: 'mutation CreateUser($name: String!) { createUser(name: $name) { id name } }',
	input: { fields: { name: 'String' }, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/users/', ['createUser', 'id']] },
}

const boomArtifact = {
	name: 'Boom',
	kind: 'HoudiniMutation',
	raw: 'mutation Boom { boom { id } }',
	input: { fields: {}, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/users/', ['boom', 'id']] },
}

const uploadArtifact = {
	name: 'UploadAvatar',
	kind: 'HoudiniMutation',
	raw: 'mutation UploadAvatar($file: File!) { uploadAvatar(file: $file) { id } }',
	input: { fields: { file: 'File' }, types: {}, defaults: {}, runtimeScalars: {} },
	endpoint: { redirect: ['/users/', ['uploadAvatar', 'id']] },
}

function serverWith(onRender: (args: any) => any = () => new Response('page')) {
	return _serverHandler({
		// a real schema → _serverHandler builds a real Yoga internally
		schema,
		client: { componentCache: {}, registerProxy: vi.fn() } as any,
		production: true,
		manifest: {
			pages: {},
			pagesByUrl: {},
			formActions: {
				CreateUser: () => Promise.resolve({ default: createUserArtifact as any }),
				Boom: () => Promise.resolve({ default: boomArtifact as any }),
				UploadAvatar: () => Promise.resolve({ default: uploadArtifact as any }),
			},
		} as any,
		assetPrefix: '',
		graphqlEndpoint: '/_api',
		componentCache: {},
		config_file: { router: {} } as any,
		on_render: onRender,
	})
}

function formPOST(
	url: string,
	body: Record<string, string>,
	headers: Record<string, string> = { origin: 'http://localhost' }
) {
	return new Request(url, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
		body: new URLSearchParams(body),
	})
}

describe('no-JS form submission (real Yoga)', () => {
	test('runs the mutation and 303s to the interpolated redirect', async () => {
		const handler = serverWith()
		const res = await handler(
			formPOST('http://localhost/users/new', { __houdini_form: 'CreateUser', name: 'Alice' })
		)
		// the redirect target comes from the REAL mutation result (createUser.id === "7")
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/users/7')
	})

	test('a GraphQL error re-renders the page with the real errors, status 422', async () => {
		let seen: any
		const handler = serverWith((args) => {
			seen = args
			return new Response('page', { status: 200 })
		})
		const res = await handler(formPOST('http://localhost/x', { __houdini_form: 'Boom' }))
		expect(res.status).toBe(422)
		// the real GraphQL errors are threaded through (Yoga masks the message in
		// production, but the error is present and keyed by form id)
		expect(seen.formResult.Boom.errors.length).toBeGreaterThan(0)
	})

	test('a multipart form with a file uploads it through to the mutation', async () => {
		const handler = serverWith()
		const form = new FormData()
		form.set('__houdini_form', 'UploadAvatar')
		// a native <form enctype="multipart/form-data"> with a file input posts this shape
		form.set('file', new Blob(['avatar-bytes'], { type: 'text/plain' }), 'avatar.txt')
		const res = await handler(
			new Request('http://localhost/x', {
				method: 'POST',
				headers: { origin: 'http://localhost' }, // FormData sets the multipart content-type
				body: form,
			})
		)
		// uploadAvatar(file: File!) succeeding (303, not a 422 non-null error) proves the
		// file survived coercion + the multipart request all the way to the resolver
		expect(res.status).toBe(303)
		expect(res.headers.get('location')).toBe('/users/9')
	})

	test('the GraphQL endpoint rejects a form-encoded body (no bypass around the form handler)', async () => {
		// a form-encoded POST straight to the graphql endpoint must not execute as an
		// operation — otherwise it would be a CSRF bypass around handleForm's Origin check
		const handler = serverWith()
		const res = await handler(
			formPOST('http://localhost/_api', { query: 'mutation { createUser(name: "x") { id } }' })
		)
		expect(res.status).not.toBe(200)
	})
})
