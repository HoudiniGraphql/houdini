/**
 * This file is copied from graphql-relay-js: https://github.com/graphql/graphql-relay-js/blob/main/src/connection/arrayConnection.ts
 * It's licensed under the MIT license found at the bottom of the file (per the project's agreement)
 */

export function connectionFromArray(data, args) {
	return connectionFromArraySlice(data, args, {
		sliceStart: 0,
		arrayLength: data.length,
	})
}

function connectionFromArraySlice(arraySlice, args, meta) {
	const { after, before, first, last } = args
	const { sliceStart, arrayLength } = meta
	const sliceEnd = sliceStart + arraySlice.length

	let startOffset = Math.max(sliceStart, 0)
	let endOffset = Math.min(sliceEnd, arrayLength)

	const afterOffset = getOffsetWithDefault(after, -1)
	if (0 <= afterOffset && afterOffset < arrayLength) {
		startOffset = Math.max(startOffset, afterOffset + 1)
	}

	const beforeOffset = getOffsetWithDefault(before, endOffset)
	if (0 <= beforeOffset && beforeOffset < arrayLength) {
		endOffset = Math.min(endOffset, beforeOffset)
	}

	if (typeof first === 'number') {
		if (first < 0) {
			throw new Error('Argument "first" must be a non-negative integer')
		}

		endOffset = Math.min(endOffset, startOffset + first)
	}
	if (typeof last === 'number') {
		if (last < 0) {
			throw new Error('Argument "last" must be a non-negative integer')
		}

		startOffset = Math.max(startOffset, endOffset - last)
	}

	// If supplied slice is too large, trim it down before mapping over it.
	const slice = arraySlice.slice(startOffset - sliceStart, endOffset - sliceStart)

	const edges = slice.map((value, index) => ({
		cursor: offsetToCursor(startOffset + index),
		node: value,
	}))

	const firstEdge = edges[0]
	const lastEdge = edges[edges.length - 1]
	const lowerBound = 0
	const upperBound = arrayLength

	return {
		edges,
		pageInfo: {
			startCursor: firstEdge ? firstEdge.cursor : null,
			endCursor: lastEdge ? lastEdge.cursor : null,
			hasPreviousPage: startOffset > lowerBound,
			hasNextPage: endOffset < upperBound,
		},
	}
}
const PREFIX = 'arrayconnection:'

/**
 * Creates the cursor string from an offset.
 */
export function offsetToCursor(offset) {
	return base64(PREFIX + offset.toString())
}

/**
 * Extracts the offset from the cursor string.
 */
export function cursorToOffset(cursor) {
	return parseInt(unbase64(cursor).substring(PREFIX.length), 10)
}

/**
 * Return the cursor associated with an object in an array.
 */
export function cursorForObjectInConnection(data, object) {
	const offset = data.indexOf(object)
	if (offset === -1) {
		return null
	}
	return offsetToCursor(offset)
}

/**
 * Given an optional cursor and a default offset, returns the offset
 * to use; if the cursor contains a valid offset, that will be used,
 * otherwise it will be the default.
 */
export function getOffsetWithDefault(cursor, defaultOffset) {
	if (typeof cursor !== 'string') {
		return defaultOffset
	}
	const offset = cursorToOffset(cursor)
	return isNaN(offset) ? defaultOffset : offset
}

function base64(str) {
	return btoa(str)
}

function unbase64(str) {
	return atob(str)
}

/**
 * 
MIT License

Copyright (c) GraphQL Contributors

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
