/*!
 * cookie
 * Copyright(c) 2012-2014 Roman Shtylman
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module letiables.
 * @private
 */

let __toString = Object.prototype.toString

/**
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */

// eslint-disable-next-line no-control-regex
let fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/

/**
 * Parse a cookie header.
 *
 * Parse the given cookie header string into an object
 * The object has the various cookies as keys(names) => values
 *
 * @param {string} str
 * @param {object} [options]
 * @return {object}
 * @public
 */

export function parse(
	str: string,
	options?: { decode?: (val: string) => string }
): Record<string, string> {
	if (typeof str !== 'string') {
		throw new TypeError('argument str must be a string')
	}

	let obj: Record<string, string> = {}
	let opt = options || {}
	let dec = opt.decode || decode

	let index = 0
	while (index < str.length) {
		let eqIdx = str.indexOf('=', index)

		// no more cookie pairs
		if (eqIdx === -1) {
			break
		}

		let endIdx = str.indexOf(';', index)

		if (endIdx === -1) {
			endIdx = str.length
		} else if (endIdx < eqIdx) {
			// backtrack on prior semicolon
			index = str.lastIndexOf(';', eqIdx - 1) + 1
			continue
		}

		let key = str.slice(index, eqIdx).trim()

		// only assign once
		if (undefined === obj[key]) {
			let val = str.slice(eqIdx + 1, endIdx).trim()

			// quoted values
			if (val.charCodeAt(0) === 0x22) {
				val = val.slice(1, -1)
			}

			obj[key] = tryDecode(val, dec)
		}

		index = endIdx + 1
	}

	return obj
}

/**
 * Serialize data into a cookie header.
 *
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 *
 * serialize('foo', 'bar', { httpOnly: true })
 *   => "foo=bar; httpOnly"
 *
 */

export function serialize(
	name: string,
	val: string,
	options: {
		encode: boolean
		maxAge: number
		domain: string
		path: string
		expires: Date
		httpOnly: boolean
		priority: string | number
		secure: boolean
		sameSite: string | boolean
	}
): string {
	let opt = options || {}
	let enc = opt.encode || encode

	if (typeof enc !== 'function') {
		throw new TypeError('option encode is invalid')
	}

	if (!fieldContentRegExp.test(name)) {
		throw new TypeError('argument name is invalid')
	}

	let value = enc(val)

	if (value && !fieldContentRegExp.test(value)) {
		throw new TypeError('argument val is invalid')
	}

	let str = name + '=' + value

	if (opt.maxAge !== null) {
		let maxAge = opt.maxAge - 0

		if (Number.isNaN(maxAge) || !isFinite(maxAge)) {
			throw new TypeError('option maxAge is invalid')
		}

		str += '; Max-Age=' + Math.floor(maxAge)
	}

	if (opt.domain) {
		if (!fieldContentRegExp.test(opt.domain)) {
			throw new TypeError('option domain is invalid')
		}

		str += '; Domain=' + opt.domain
	}

	if (opt.path) {
		if (!fieldContentRegExp.test(opt.path)) {
			throw new TypeError('option path is invalid')
		}

		str += '; Path=' + opt.path
	}

	if (opt.expires) {
		let expires = opt.expires

		if (!isDate(expires) || Number.isNaN(expires.valueOf())) {
			throw new TypeError('option expires is invalid')
		}

		str += '; Expires=' + expires.toUTCString()
	}

	if (opt.httpOnly) {
		str += '; HttpOnly'
	}

	if (opt.secure) {
		str += '; Secure'
	}

	if (opt.priority) {
		let priority = typeof opt.priority === 'string' ? opt.priority.toLowerCase() : opt.priority

		switch (priority) {
			case 'low':
				str += '; Priority=Low'
				break
			case 'medium':
				str += '; Priority=Medium'
				break
			case 'high':
				str += '; Priority=High'
				break
			default:
				throw new TypeError('option priority is invalid')
		}
	}

	if (opt.sameSite) {
		let sameSite = typeof opt.sameSite === 'string' ? opt.sameSite.toLowerCase() : opt.sameSite

		switch (sameSite) {
			case true:
				str += '; SameSite=Strict'
				break
			case 'lax':
				str += '; SameSite=Lax'
				break
			case 'strict':
				str += '; SameSite=Strict'
				break
			case 'none':
				str += '; SameSite=None'
				break
			default:
				throw new TypeError('option sameSite is invalid')
		}
	}

	return str
}

/**
 * URL-decode string value. Optimized to skip native call when no %.
 *
 * @param {string} str
 * @returns {string}
 */

function decode(str: string): string {
	return str.indexOf('%') !== -1 ? decodeURIComponent(str) : str
}

/**
 * URL-encode value.
 *
 * @param {string} str
 * @returns {string}
 */

function encode(val: string): string {
	return encodeURIComponent(val)
}

/**
 * Determine if value is a Date.
 *
 * @param {*} val
 * @private
 */

function isDate(val: any) {
	return __toString.call(val) === '[object Date]' || val instanceof Date
}

/**
 * Try decoding a string using a decoding function.
 *
 * @param {string} str
 * @param {function} decode
 * @private
 */

function tryDecode(str: string, decode: (val: string) => string) {
	try {
		return decode(str)
	} catch (e) {
		return str
	}
}
