import { getCurrentConfig } from '$houdini/runtime/config'
import type { DocumentStore } from '$houdini/runtime/client'
import { entityRefetchVariables } from 'houdini/runtime'
import type {
	FragmentArtifact,
	GraphQLObject,
	GraphQLVariables,
	QueryArtifact,
} from 'houdini/runtime'
import { CompiledFragmentKind, fragmentKey } from 'houdini/runtime'
import { derived, get } from 'svelte/store'
import type { Readable, Subscriber } from 'svelte/store'

import { getClient, initClient } from '../client.js'
import { getSession } from '../session.js'
import { FragmentStore } from './fragment.js'
import type { StoreConfig } from './query.js'

type RefetchableFragmentStoreConfig<_Data extends GraphQLObject, _Input> = StoreConfig<
	_Data,
	_Input,
	FragmentArtifact
> & { refetchArtifact: QueryArtifact }

// the value handed back to components subscribing to a refetchable fragment store
export type RefetchableFragmentResult<_Data extends GraphQLObject, _Input> = {
	data: _Data | null
	variables: _Input
}

// Keyed by "<refetchQueryName>:<entityID>" so reactive re-invocations of get() (e.g. when
// the parent query re-emits after a refetch writes to the cache) reuse the same observer
// instead of starting over with no variables/data. Mirrors _singlePageStateCache in
// stores/pagination/fragment.ts.
const _refetchStateCache = new Map<string, { refetchStore: DocumentStore<any, any> }>()

// FragmentStoreRefetchable backs the refetchableFragment() helper. The fragment is
// embedded in a query keyed by id (the same wrapper @paginate uses, minus the list
// semantics); refetch() re-runs that query with new argument values and swaps the
// fresh result in for the masked fragment data.
export class FragmentStoreRefetchable<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables,
> {
	kind = CompiledFragmentKind
	artifact: FragmentArtifact
	name: string
	// a flag the refetchableFragment() helper looks for to validate the store
	refetchable = true
	protected refetchArtifact: QueryArtifact

	constructor(config: RefetchableFragmentStoreConfig<_Data, _Input>) {
		this.artifact = config.artifact
		this.name = config.storeName
		this.refetchArtifact = config.refetchArtifact
	}

	get(initialValue: _Data | { [fragmentKey]: _ReferenceType } | null) {
		const base = new FragmentStore<_Data, {}, _Input>({
			artifact: this.artifact,
			storeName: this.name,
		})
		const store = base.get(initialValue)

		// observe the embedded query so refetch() can swap in fresh data. reuse a cached
		// observer (keyed by the fragment's parent id) across reactive re-invocations of
		// get() so a second refetch keeps the entity id and prior variables.
		const parentID = (initialValue as any)?.[fragmentKey]?.values?.[this.artifact.name]?.parent
		const stateKey = parentID ? `${this.refetchArtifact.name}:${parentID}` : null
		const cached = stateKey ? _refetchStateCache.get(stateKey) : null

		let refetchStore: DocumentStore<_Data, _Input>
		if (cached) {
			refetchStore = cached.refetchStore
		} else {
			refetchStore = getClient().observe<_Data, _Input>({
				artifact: this.refetchArtifact,
				initialValue: store.initialValue,
			})
			if (stateKey) {
				_refetchStateCache.set(stateKey, { refetchStore })
			}
		}

		// the embedded query wraps the entity in a root field (e.g. "node")
		const rootField = Object.keys(this.refetchArtifact.selection.fields ?? {})[0]
		const refetchEntity = (): _Data | null => {
			if (!rootField) return null
			const wrapped = (get(refetchStore).data as any)?.[rootField]
			return wrapped ? (wrapped as _Data) : null
		}

		// re-run the embedded query with new argument values. the entity's id is derived
		// from the parent fragment reference, which always carries the (visible) id. we must
		// NOT derive it from the embedded query result: the fragment masks the entity's id
		// out of that selection, so reading it back would yield `id: undefined` and clobber
		// the real id on a second refetch.
		const refetch = async (variables?: Partial<_Input>) => {
			await initClient()
			const state =
				store.initialValue ??
				(get({ subscribe: store.subscribe }) as _Data | null) ??
				refetchEntity()
			const idVariables = entityRefetchVariables(
				getCurrentConfig(),
				this.refetchArtifact.refetch?.targetType,
				state as Record<string, any> | null
			)
			const sentVars = {
				...(get(refetchStore).variables ?? store.variables),
				...idVariables,
				...variables,
			} as _Input
			return await refetchStore.send({
				session: await getSession(),
				variables: sentVars,
				// suppress loading-state placeholder data during the transition so the
				// currently displayed value stays put until the fresh result arrives
				stuff: { silenceLoading: true },
				cacheParams: { disableSubscriptions: true, disablePartial: true },
			})
		}

		const parent: Readable<_Data | null> = { subscribe: store.subscribe }
		const subscribe = (
			run: Subscriber<RefetchableFragmentResult<_Data, _Input>>,
			invalidate?: (value?: RefetchableFragmentResult<_Data, _Input>) => void
		): (() => void) => {
			const combined = derived([parent, refetchStore], ([$parent, $refetch]) => {
				let data = $parent as _Data | null
				if (rootField) {
					const wrapped = ($refetch.data as any)?.[rootField]
					if (wrapped) {
						data = wrapped as _Data
					}
				}
				return {
					data,
					variables: ($refetch.variables ?? store.variables) as _Input,
				}
			})
			return combined.subscribe(run, invalidate)
		}

		return {
			kind: CompiledFragmentKind,
			subscribe,
			refetch,
		}
	}
}
