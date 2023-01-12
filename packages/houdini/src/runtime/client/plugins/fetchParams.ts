import { ClientPlugin, ClientPluginContextValue } from '../documentObserver'

export type FetchParamFn = (
	ctx: ClientPluginContextValue
) => Required<ClientPluginContextValue>['fetchParams']

export const fetchParamsPlugin: (fn?: FetchParamFn) => ClientPlugin =
	(fn = () => ({})) =>
	() => ({
		setup: {
			enter(ctx, { next }) {
				next({ ...ctx, fetchParams: fn(ctx) })
			},
		},
	})
