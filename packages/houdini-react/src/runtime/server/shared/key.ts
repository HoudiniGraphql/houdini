import { isCallable } from '../utils/isCallable'
import { assertUsage } from './utils'

export { stringifyKey }
export { assertKey }

function stringifyKey(key: unknown): string {
	const keyString = JSON.stringify(key)
	return keyString
}

function assertKey(keyValue: unknown) {
	assertUsage(
		keyValue,
		`[useAsync(key, asyncFn)] You provided a \`key\` with the value \`${keyValue}\` which is forbidden.`
	)
	assertUsage(
		!isCallable(keyValue),
		`[useAsync(key, asyncFn)] You provided a \`key\` that is a function which is forbidden.`
	)
}
