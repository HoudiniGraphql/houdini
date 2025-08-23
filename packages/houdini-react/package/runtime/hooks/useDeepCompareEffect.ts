import { deepEquals } from 'houdini/src/runtime/lib/deepEquals'
import * as React from 'react'

// This file is largely a copy and paste from Kent C. Dodd's use-deep-compare-effect (appropriate license at the bottom).
// It has been copied locally in order to avoid any awkward third party peer dependencies
// on generated files (which would make the install annoying). The deep equals library has
// also been changed to use one that was already included in the runtime (avoiding the extra bundle size)

type UseEffectParams = Parameters<typeof React.useEffect>
type EffectCallback = UseEffectParams[0]
type DependencyList = UseEffectParams[1]
// yes, I know it's void, but I like what this communicates about
// the intent of these functions: It's just like useEffect
type UseEffectReturn = ReturnType<typeof React.useEffect>

function checkDeps(deps: DependencyList) {
	if (!deps || !deps.length) {
		throw new Error(
			'useDeepCompareEffect should not be used with no dependencies. Use React.useEffect instead.'
		)
	}
	if (deps.every(isPrimitive)) {
		throw new Error(
			'useDeepCompareEffect should not be used with dependencies that are all primitive values. Use React.useEffect instead.'
		)
	}
}

function isPrimitive(val: unknown) {
	return val == null || /^[sbn]/.test(typeof val)
}

/**
 * @param value the value to be memoized (usually a dependency list)
 * @returns a memoized version of the value as long as it remains deeply equal
 */
export function useDeepCompareMemoize<T>(value: T) {
	const ref = React.useRef<T>(value)
	const signalRef = React.useRef<number>(0)

	if (!deepEquals(value, ref.current)) {
		ref.current = value
		signalRef.current += 1
	}

	return React.useMemo(() => ref.current, [signalRef.current])
}

function useDeepCompareEffect(
	callback: EffectCallback,
	dependencies: DependencyList
): UseEffectReturn {
	if (process.env.NODE_ENV !== 'production') {
		checkDeps(dependencies)
	}
	return React.useEffect(callback, useDeepCompareMemoize(dependencies))
}

export function useDeepCompareEffectNoCheck(
	callback: EffectCallback,
	dependencies: DependencyList
): UseEffectReturn {
	return React.useEffect(callback, useDeepCompareMemoize(dependencies))
}

export default useDeepCompareEffect

/**
The MIT License (MIT)
Copyright (c) 2020 Kent C. Dodds

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
