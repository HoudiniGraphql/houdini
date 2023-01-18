import type { ClientPlugin, ClientPluginContext } from '../documentObserver'

export type FetchParamFn = (
	ctx: ClientPluginContext
) => Required<ClientPluginContext>['fetchParams']

export const fetchParamsPlugin: (fn?: FetchParamFn) => ClientPlugin =
	(fn = () => ({})) =>
	() => ({
		start(ctx, { next }) {
			next({ ...ctx, fetchParams: fn(ctx) })
		},
	})
