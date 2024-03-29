import type { GraphQLVariables } from '$houdini/runtime/lib/types'

import { parseScalar, type ConfigFile } from '../lib'
import type { RouterManifest, RouterPageManifest } from './types'

/**
 * This file is copied from the SvelteKit source code under the MIT license found at the bottom of the file
 */
const param_pattern = /^(\[)?(\.\.\.)?(\w+)(?:=(\w+))?(\])?$/

export type RouteParam = {
	name: string
	matcher: string
	optional: boolean
	rest: boolean
	chained: boolean
}

export interface ParamMatcher {
	(param: string): boolean
}

// find the matching page given the current path
export function find_match<_ComponentType>(
	config: ConfigFile,
	manifest: RouterManifest<_ComponentType>,
	current: string,
	allowNull: true
): [RouterPageManifest<_ComponentType> | null, GraphQLVariables]
export function find_match<_ComponentType>(
	config: ConfigFile,
	manifest: RouterManifest<_ComponentType>,
	current: string,
	allowNull?: false
): [RouterPageManifest<_ComponentType>, GraphQLVariables]
export function find_match<_ComponentType>(
	config: ConfigFile,
	manifest: RouterManifest<_ComponentType>,
	current: string,
	allowNull: boolean = true
): [RouterPageManifest<_ComponentType>, GraphQLVariables] {
	// find the matching path (if it exists)
	let match: RouterPageManifest<_ComponentType> | null = null
	let matchVariables: GraphQLVariables = null

	for (const page of Object.values(manifest.pages)) {
		// check if the current url matches
		const urlMatch = current.match(page.pattern)
		if (!urlMatch) {
			continue
		}

		// we found a match!!
		match = page
		matchVariables = exec(urlMatch, page.params) || {}
		break
	}

	if (!match && !allowNull) {
		throw new Error('404')
	}

	// we might have to marshal the variables
	let variables: GraphQLVariables = {}
	// each of the matched documents might tell us how to handle a subset of the
	// matchVariables. look at every document's input specification and marshal
	// any values that are in matchVariables
	for (const document of Object.values(match?.documents ?? {})) {
		for (const [variable, { type }] of Object.entries(document.variables)) {
			if (matchVariables?.[variable]) {
				variables[variable] = parseScalar(config, type, matchVariables[variable])
			}
		}
	}

	// @ts-ignore
	return [match, variables]
}

/**
 * Creates the regex pattern, extracts parameter names, and generates types for a route
 */
export function parse_page_pattern(id: string) {
	const params: RouteParam[] = []

	const pattern =
		id === '/'
			? /^\/$/
			: new RegExp(
					`^${get_route_segments(id)
						.map((segment) => {
							// special case — /[...rest]/ could contain zero segments
							const rest_match = /^\[\.\.\.(\w+)(?:=(\w+))?\]$/.exec(segment)
							if (rest_match) {
								params.push({
									name: rest_match[1],
									matcher: rest_match[2],
									optional: false,
									rest: true,
									chained: true,
								})
								return '(?:/(.*))?'
							}
							// special case — /[[optional]]/ could contain zero segments
							const optional_match = /^\[\[(\w+)(?:=(\w+))?\]\]$/.exec(segment)
							if (optional_match) {
								params.push({
									name: optional_match[1],
									matcher: optional_match[2],
									optional: true,
									rest: false,
									chained: true,
								})
								return '(?:/([^/]+))?'
							}

							if (!segment) {
								return
							}

							const parts = segment.split(/\[(.+?)\](?!\])/)
							const result = parts
								.map((content, i) => {
									if (i % 2) {
										if (content.startsWith('x+')) {
											return escape(
												String.fromCharCode(parseInt(content.slice(2), 16))
											)
										}

										if (content.startsWith('u+')) {
											return escape(
												String.fromCharCode(
													...content
														.slice(2)
														.split('-')
														.map((code) => parseInt(code, 16))
												)
											)
										}

										const match = param_pattern.exec(content)
										if (!match) {
											throw new Error(
												`Invalid param: ${content}. Params and matcher names can only have underscores and alphanumeric characters.`
											)
										}

										const [, is_optional, is_rest, name, matcher] = match
										// It's assumed that the following invalid route id cases are already checked
										// - unbalanced brackets
										// - optional param following rest param

										params.push({
											name,
											matcher,
											optional: !!is_optional,
											rest: !!is_rest,
											chained: is_rest ? i === 1 && parts[0] === '' : false,
										})
										return is_rest
											? '(.*?)'
											: is_optional
											? '([^/]*)?'
											: '([^/]+?)'
									}

									return escape(content)
								})
								.join('')

							return '/' + result
						})
						.join('')}/?$`
			  )

	return { pattern, params, page_id: id }
}

/**
 * Returns `false` for `(group)` segments
 */
function affects_path(segment: string) {
	return !/^\([^)]+\)$/.test(segment)
}

/**
 * Splits a route id into its segments, removing segments that
 * don't affect the path (i.e. groups). The root route is represented by `/`
 * and will be returned as `['']`.
 */
export function get_route_segments(route: string) {
	return route.slice(1).split('/').filter(affects_path)
}

export function exec(match: RegExpMatchArray, params: RouteParam[]) {
	const result: Record<string, string> = {}

	const values = match.slice(1)

	let buffered = ''

	for (let i = 0; i < (params || []).length; i += 1) {
		const param = params[i]
		let value = values[i]

		if (param.chained && param.rest && buffered) {
			// in the `[[lang=lang]]/[...rest]` case, if `lang` didn't
			// match, we roll it over into the rest value
			value = value ? buffered + '/' + value : buffered
		}

		buffered = ''

		if (value === undefined) {
			// if `value` is undefined, it means this is
			// an optional or rest parameter
			if (param.rest) result[param.name] = ''
		} else {
			result[param.name] = value
		}
	}

	if (buffered) return
	return result
}

function escape(str: string) {
	return (
		str
			.normalize()
			// escape [ and ] before escaping other characters, since they are used in the replacements
			.replace(/[[\]]/g, '\\$&')
			// replace %, /, ? and # with their encoded versions because decode_pathname leaves them untouched
			.replace(/%/g, '%25')
			.replace(/\//g, '%2[Ff]')
			.replace(/\?/g, '%3[Ff]')
			.replace(/#/g, '%23')
			// escape characters that have special meaning in regex
			.replace(/[.*+?^${}()|\\]/g, '\\$&')
	)
}

/**
Copyright (c) 2020 [these people](https://github.com/sveltejs/kit/graphs/contributors)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
