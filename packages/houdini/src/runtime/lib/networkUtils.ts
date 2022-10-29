/// This file contains a modified version, made by AlecAivazis, of the functions found here: https://github.com/jaydenseric/extract-files/blob/master/extractFiles.mjs
/// The associated license is at the end of the file (per the project's license agreement)

export function isExtractableFile(value: any): value is ExtractableFile {
	return (
		(typeof File !== 'undefined' && value instanceof File) ||
		(typeof Blob !== 'undefined' && value instanceof Blob)
	)
}

type ExtractableFile = File | Blob

/** @typedef {import("./isExtractableFile.mjs").default} isExtractableFile */

export function extractFiles(value: any) {
	if (!arguments.length) throw new TypeError('Argument 1 `value` is required.')

	/**
	 * Deeply clonable value.
	 * @typedef {Array<unknown> | FileList | Record<PropertyKey, unknown>} Cloneable
	 */

	/**
	 * Clone of a {@link Cloneable deeply cloneable value}.
	 * @typedef {Exclude<Cloneable, FileList>} Clone
	 */

	/**
	 * Map of values recursed within the input value and their clones, for reusing
	 * clones of values that are referenced multiple times within the input value.
	 * @type {Map<Cloneable, Clone>}
	 */
	const clones = new Map()

	/**
	 * Extracted files and their object paths within the input value.
	 * @type {Extraction<Extractable>["files"]}
	 */
	const files = new Map()

	/**
	 * Recursively clones the value, extracting files.
	 */
	function recurse(value: any, path: string | string[], recursed: Set<any>) {
		if (isExtractableFile(value)) {
			const filePaths = files.get(value)

			filePaths ? filePaths.push(path) : files.set(value, [path])

			return null
		}

		const valueIsList =
			Array.isArray(value) || (typeof FileList !== 'undefined' && value instanceof FileList)
		const valueIsPlainObject = isPlainObject(value)

		if (valueIsList || valueIsPlainObject) {
			let clone = clones.get(value)

			const uncloned = !clone

			if (uncloned) {
				clone = valueIsList
					? []
					: // Replicate if the plain object is an `Object` instance.
					value instanceof /** @type {any} */ Object
					? {}
					: Object.create(null)

				clones.set(value, /** @type {Clone} */ clone)
			}

			if (!recursed.has(value)) {
				const pathPrefix = path ? `${path}.` : ''
				const recursedDeeper = new Set(recursed).add(value)

				if (valueIsList) {
					let index = 0

					// @ts-ignore
					for (const item of value) {
						const itemClone = recurse(item, pathPrefix + index++, recursedDeeper)

						if (uncloned) /** @type {Array<unknown>} */ clone.push(itemClone)
					}
				} else
					for (const key in value) {
						const propertyClone = recurse(value[key], pathPrefix + key, recursedDeeper)

						if (uncloned)
							/** @type {Record<PropertyKey, unknown>} */ clone[key] = propertyClone
					}
			}

			return clone
		}

		return value
	}

	return {
		clone: recurse(value, '', new Set()),
		files,
	}
}

/**
 * An extraction result.
 * @template [Extractable=unknown] Extractable file type.
 * @typedef {object} Extraction
 * @prop {unknown} clone Clone of the original value with extracted files
 *   recursively replaced with `null`.
 * @prop {Map<Extractable, Array<ObjectPath>>} files Extracted files and their
 *   object paths within the original value.
 */

/**
 * String notation for the path to a node in an object tree.
 * @typedef {string} ObjectPath
 * @see [`object-path` on npm](https://npm.im/object-path).
 * @example
 * An object path for object property `a`, array index `0`, object property `b`:
 *
 * ```
 * a.0.b
 * ```
 */

function isPlainObject(value: any) {
	if (typeof value !== 'object' || value === null) {
		return false
	}

	const prototype = Object.getPrototypeOf(value)
	return (
		(prototype === null ||
			prototype === Object.prototype ||
			Object.getPrototypeOf(prototype) === null) &&
		!(Symbol.toStringTag in value) &&
		!(Symbol.iterator in value)
	)
}

// MIT License
// Copyright Jayden Seric

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
