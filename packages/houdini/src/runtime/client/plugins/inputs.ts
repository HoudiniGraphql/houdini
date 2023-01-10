import { ArtifactKind, deepEquals, marshalInputs } from '../../lib'
import { ClientPlugin, ClientPluginContext } from '../documentObserver'

export function marshaledInputs(ctx: ClientPluginContext) {
	return ctx.stuff.inputs?.marshaled ?? {}
}

export function variablesChanged(ctx: ClientPluginContext) {
	return ctx.stuff.inputs?.changed
}

export const inputsPlugin: ClientPlugin = () => {
	let previous: {} | null | undefined = null
	return {
		setup: {
			async enter(ctx, { next }) {
				let newContext = ctx

				// if we aren't working with a fragment then we can marshal the inputs
				if (ctx.artifact.kind !== ArtifactKind.Fragment) {
					// marshal the inputs for other plugins
					const marshaled = await marshalInputs({
						input: ctx.variables ?? {},
						artifact: ctx.artifact,
					})

					// look at the old value to see if they have changed
					const changed = !deepEquals(previous, marshaled)

					// track the current variables as the "previous ones"
					previous = marshaled

					// add the necessary metadata for the rest of the plugins to use
					newContext = {
						...ctx,
						stuff: {
							...ctx.stuff,
							inputs: {
								changed,
								marshaled,
							},
						},
					}
				}

				// move on with the new input metadata
				next(newContext)
			},
		},
	}
}
