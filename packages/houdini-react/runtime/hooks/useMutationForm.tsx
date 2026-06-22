import { getCurrentConfig } from '$houdini/runtime'
import type { MutationArtifact, GraphQLObject, GraphQLVariables } from 'houdini/runtime'
import { coerceFormData, interpolateRedirect } from 'houdini/runtime'
import React from 'react'

import { useSession, useRoute, useFormResult } from '../routing/Router.js'
import { useDocumentStore } from './useDocumentStore.js'

// a document with no variables still needs an InputObject shape for the coercer
const EMPTY_INPUT = { fields: {}, types: {}, defaults: {}, runtimeScalars: {} }

export type MutationFormState = { data: any; errors: any } | null

export type UseMutationFormOptions<_Result = any> = {
	// disambiguates multiple forms for the same mutation on one page, and is the key the
	// server uses for the injected result. Defaults to the @endpoint(id:) or mutation name.
	id?: string
	// enhanced-path-only side effects (no-ops without JS, which is the correct degradation)
	onSuccess?: (data: _Result) => void
	onError?: (errors: any) => void
}

export type MutationForm<_Result = any> = {
	// spread onto a <form>: a real string action (native POST before hydration) that the
	// onSubmit intercepts after. Identical on server and client → clean hydration.
	form: {
		action: string
		method: 'post'
		onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
		encType?: 'multipart/form-data'
	}
	// the hidden marker fields the no-JS POST needs; render inside the <form>
	hidden: React.ReactNode
	// { data, errors } | null — seeded from the server's no-JS result, then the enhanced result
	state: { data: _Result; errors: any } | null
	pending: boolean
}

/**
 * useMutationForm turns a mutation marked with @endpoint into a progressively-enhanced
 * form. The returned `form`/`hidden` render a real string-action `<form>` that submits
 * natively before/without JS; after hydration `onSubmit` runs the mutation client-side
 * (optimistic + cache via the normal send) and navigates on success. `state` converges on
 * the same `{ data, errors }` shape on both paths.
 */
export function useMutationForm<
	_Result extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	document: { artifact: MutationArtifact },
	opts: UseMutationFormOptions<_Result> = {}
): MutationForm<_Result> {
	const { artifact } = document
	const [storeValue, observer] = useDocumentStore<_Result, _Input>({ artifact })
	const [session] = useSession()
	const { pathname, goto } = useRoute()

	const formId = opts.id ?? artifact.endpoint?.id ?? artifact.name

	// seed from the server-injected result so the no-JS re-render and the enhanced path
	// converge; null on a fresh form or once enhanced
	const injected = useFormResult(formId)
	const [state, setState] = React.useState<MutationFormState>(injected)
	const [submitting, setSubmitting] = React.useState(false)

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		// only reached after hydration — before that the browser submits natively
		event.preventDefault()
		setSubmitting(true)
		try {
			const variables = coerceFormData(
				new FormData(event.currentTarget),
				artifact.input ?? EMPTY_INPUT,
				getCurrentConfig()
			) as _Input
			const result = await observer.send({ variables, session })
			const errors = result.errors ?? null
			setState({ data: result.data, errors })
			if (errors && errors.length > 0) {
				opts.onError?.(errors)
			} else {
				opts.onSuccess?.(result.data as _Result)
				// navigate to the same target the server would 303 to
				const redirect = artifact.endpoint?.redirect
				if (redirect) {
					const target = interpolateRedirect(redirect, result.data)
					if (target) {
						goto(target)
					}
				}
			}
		} catch (error: any) {
			const errors = error?.raw ?? [{ message: error?.message ?? String(error) }]
			setState({ data: null, errors })
			opts.onError?.(errors)
		} finally {
			setSubmitting(false)
		}
	}

	const form: MutationForm<_Result>['form'] = {
		action: pathname,
		method: 'post',
		onSubmit,
		...(artifact.endpoint?.multipart ? { encType: 'multipart/form-data' as const } : {}),
	}

	const hidden = (
		<>
			<input type="hidden" name="__houdini_form" value={artifact.name} />
			<input type="hidden" name="__houdini_form_id" value={formId} />
		</>
	)

	return { form, hidden, state, pending: submitting || storeValue.fetching }
}
