import { ClientPlugin, ClientPluginContext } from '../documentObserver'

export type FetchParamFn = (
	ctx: ClientPluginContext
) => Required<ClientPluginContext>['fetchParams']

export const fetchParamsPlugin: (fn?: FetchParamFn) => ClientPlugin =
	(fn = () => ({})) =>
	() => ({
		setup: {
			enter(ctx, { next }) {
				next({ ...ctx, fetchParams: fn(ctx) })
			},
		},
	})
