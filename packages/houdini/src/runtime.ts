// externals
import { Interaction } from 'houdini-compiler'
// locals
import { getEnvironment } from './environment'

// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
export function fetchQuery({
	text,
	variables,
}: {
	text: string
	variables: { [name: string]: unknown }
}) {
	return getEnvironment()?.sendRequest({ text, variables })
}

export function applyInteraction<_StateType, _PayloadType>(
	interaction: Interaction,
	set: (newValue: _StateType) => void,
	currentState: _StateType,
	payload: _PayloadType
) {}
