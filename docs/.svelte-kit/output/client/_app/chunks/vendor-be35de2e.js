function t() {}
const n = (t) => t
function e(t, n) {
	for (const e in n) t[e] = n[e]
	return t
}
function o(t) {
	return t()
}
function r() {
	return Object.create(null)
}
function s(t) {
	t.forEach(o)
}
function c(t) {
	return 'function' == typeof t
}
function i(t, n) {
	return t != t ? n == n : t !== n || (t && 'object' == typeof t) || 'function' == typeof t
}
function u(n, e, o) {
	n.$$.on_destroy.push(
		(function (n, ...e) {
			if (null == n) return t
			const o = n.subscribe(...e)
			return o.unsubscribe ? () => o.unsubscribe() : o
		})(e, o)
	)
}
function a(t, n, e, o) {
	if (t) {
		const r = f(t, n, e, o)
		return t[0](r)
	}
}
function f(t, n, o, r) {
	return t[1] && r ? e(o.ctx.slice(), t[1](r(n))) : o.ctx
}
function l(t, n, e, o, r, s, c) {
	const i = (function (t, n, e, o) {
		if (t[2] && o) {
			const r = t[2](o(e))
			if (void 0 === n.dirty) return r
			if ('object' == typeof r) {
				const t = [],
					e = Math.max(n.dirty.length, r.length)
				for (let o = 0; o < e; o += 1) t[o] = n.dirty[o] | r[o]
				return t
			}
			return n.dirty | r
		}
		return n.dirty
	})(n, o, r, s)
	if (i) {
		const r = f(n, e, o, c)
		t.p(r, i)
	}
}
function d(t) {
	const n = {}
	for (const e in t) '$' !== e[0] && (n[e] = t[e])
	return n
}
const h = 'undefined' != typeof window
let p = h ? () => window.performance.now() : () => Date.now(),
	$ = h ? (t) => requestAnimationFrame(t) : t
const g = new Set()
function m(t) {
	g.forEach((n) => {
		n.c(t) || (g.delete(n), n.f())
	}),
		0 !== g.size && $(m)
}
function y(t) {
	let n
	return (
		0 === g.size && $(m),
		{
			promise: new Promise((e) => {
				g.add((n = { c: t, f: e }))
			}),
			abort() {
				g.delete(n)
			},
		}
	)
}
function b(t, n) {
	t.appendChild(n)
}
function _(t, n, e) {
	t.insertBefore(n, e || null)
}
function w(t) {
	t.parentNode.removeChild(t)
}
function v(t, n) {
	for (let e = 0; e < t.length; e += 1) t[e] && t[e].d(n)
}
function x(t) {
	return document.createElement(t)
}
function k(t) {
	return document.createTextNode(t)
}
function E() {
	return k(' ')
}
function O() {
	return k('')
}
function j(t, n, e) {
	null == e ? t.removeAttribute(n) : t.getAttribute(n) !== e && t.setAttribute(n, e)
}
function A(t) {
	return Array.from(t.childNodes)
}
function C(t, n, e, o) {
	for (let r = 0; r < t.length; r += 1) {
		const o = t[r]
		if (o.nodeName === n) {
			let n = 0
			const s = []
			for (; n < o.attributes.length; ) {
				const t = o.attributes[n++]
				e[t.name] || s.push(t.name)
			}
			for (let t = 0; t < s.length; t++) o.removeAttribute(s[t])
			return t.splice(r, 1)[0]
		}
	}
	return o
		? (function (t) {
				return document.createElementNS('http://www.w3.org/2000/svg', t)
		  })(n)
		: x(n)
}
function S(t, n) {
	for (let e = 0; e < t.length; e += 1) {
		const o = t[e]
		if (3 === o.nodeType) return (o.data = '' + n), t.splice(e, 1)[0]
	}
	return k(n)
}
function M(t) {
	return S(t, ' ')
}
function P(t, n) {
	;(n = '' + n), t.wholeText !== n && (t.data = n)
}
function q(t, n, e) {
	t.classList[e ? 'add' : 'remove'](n)
}
function N(t, n = document.body) {
	return Array.from(n.querySelectorAll(t))
}
const R = new Set()
let z,
	B = 0
function D(t, n, e, o, r, s, c, i = 0) {
	const u = 16.666 / o
	let a = '{\n'
	for (let g = 0; g <= 1; g += u) {
		const t = n + (e - n) * s(g)
		a += 100 * g + `%{${c(t, 1 - t)}}\n`
	}
	const f = a + `100% {${c(e, 1 - e)}}\n}`,
		l = `__svelte_${(function (t) {
			let n = 5381,
				e = t.length
			for (; e--; ) n = ((n << 5) - n) ^ t.charCodeAt(e)
			return n >>> 0
		})(f)}_${i}`,
		d = t.ownerDocument
	R.add(d)
	const h =
			d.__svelte_stylesheet || (d.__svelte_stylesheet = d.head.appendChild(x('style')).sheet),
		p = d.__svelte_rules || (d.__svelte_rules = {})
	p[l] || ((p[l] = !0), h.insertRule(`@keyframes ${l} ${f}`, h.cssRules.length))
	const $ = t.style.animation || ''
	return (t.style.animation = `${$ ? `${$}, ` : ''}${l} ${o}ms linear ${r}ms 1 both`), (B += 1), l
}
function F(t, n) {
	const e = (t.style.animation || '').split(', '),
		o = e.filter(n ? (t) => t.indexOf(n) < 0 : (t) => -1 === t.indexOf('__svelte')),
		r = e.length - o.length
	r &&
		((t.style.animation = o.join(', ')),
		(B -= r),
		B ||
			$(() => {
				B ||
					(R.forEach((t) => {
						const n = t.__svelte_stylesheet
						let e = n.cssRules.length
						for (; e--; ) n.deleteRule(e)
						t.__svelte_rules = {}
					}),
					R.clear())
			}))
}
function T(t) {
	z = t
}
function I() {
	if (!z) throw new Error('Function called outside component initialization')
	return z
}
function L(t) {
	I().$$.on_mount.push(t)
}
function G(t) {
	I().$$.after_update.push(t)
}
function H(t, n) {
	I().$$.context.set(t, n)
}
function J(t) {
	return I().$$.context.get(t)
}
const K = [],
	Q = [],
	U = [],
	V = [],
	W = Promise.resolve()
let X = !1
function Y(t) {
	U.push(t)
}
let Z = !1
const tt = new Set()
function nt() {
	if (!Z) {
		Z = !0
		do {
			for (let t = 0; t < K.length; t += 1) {
				const n = K[t]
				T(n), et(n.$$)
			}
			for (T(null), K.length = 0; Q.length; ) Q.pop()()
			for (let t = 0; t < U.length; t += 1) {
				const n = U[t]
				tt.has(n) || (tt.add(n), n())
			}
			U.length = 0
		} while (K.length)
		for (; V.length; ) V.pop()()
		;(X = !1), (Z = !1), tt.clear()
	}
}
function et(t) {
	if (null !== t.fragment) {
		t.update(), s(t.before_update)
		const n = t.dirty
		;(t.dirty = [-1]), t.fragment && t.fragment.p(t.ctx, n), t.after_update.forEach(Y)
	}
}
let ot
function rt() {
	return (
		ot ||
			((ot = Promise.resolve()),
			ot.then(() => {
				ot = null
			})),
		ot
	)
}
function st(t, n, e) {
	t.dispatchEvent(
		(function (t, n) {
			const e = document.createEvent('CustomEvent')
			return e.initCustomEvent(t, !1, !1, n), e
		})(`${n ? 'intro' : 'outro'}${e}`)
	)
}
const ct = new Set()
let it
function ut() {
	it = { r: 0, c: [], p: it }
}
function at() {
	it.r || s(it.c), (it = it.p)
}
function ft(t, n) {
	t && t.i && (ct.delete(t), t.i(n))
}
function lt(t, n, e, o) {
	if (t && t.o) {
		if (ct.has(t)) return
		ct.add(t),
			it.c.push(() => {
				ct.delete(t), o && (e && t.d(1), o())
			}),
			t.o(n)
	}
}
const dt = { duration: 0 }
function ht(e, o, r) {
	let s,
		i,
		u = o(e, r),
		a = !1,
		f = 0
	function l() {
		s && F(e, s)
	}
	function d() {
		const { delay: o = 0, duration: r = 300, easing: c = n, tick: d = t, css: h } = u || dt
		h && (s = D(e, 0, 1, r, o, c, h, f++)), d(0, 1)
		const $ = p() + o,
			g = $ + r
		i && i.abort(),
			(a = !0),
			Y(() => st(e, !0, 'start')),
			(i = y((t) => {
				if (a) {
					if (t >= g) return d(1, 0), st(e, !0, 'end'), l(), (a = !1)
					if (t >= $) {
						const n = c((t - $) / r)
						d(n, 1 - n)
					}
				}
				return a
			}))
	}
	let h = !1
	return {
		start() {
			h || (F(e), c(u) ? ((u = u()), rt().then(d)) : d())
		},
		invalidate() {
			h = !1
		},
		end() {
			a && (l(), (a = !1))
		},
	}
}
function pt(e, o, r) {
	let i,
		u = o(e, r),
		a = !0
	const f = it
	function l() {
		const { delay: o = 0, duration: r = 300, easing: c = n, tick: l = t, css: d } = u || dt
		d && (i = D(e, 1, 0, r, o, c, d))
		const h = p() + o,
			$ = h + r
		Y(() => st(e, !1, 'start')),
			y((t) => {
				if (a) {
					if (t >= $) return l(0, 1), st(e, !1, 'end'), --f.r || s(f.c), !1
					if (t >= h) {
						const n = c((t - h) / r)
						l(1 - n, n)
					}
				}
				return a
			})
	}
	return (
		(f.r += 1),
		c(u)
			? rt().then(() => {
					;(u = u()), l()
			  })
			: l(),
		{
			end(t) {
				t && u.tick && u.tick(1, 0), a && (i && F(e, i), (a = !1))
			},
		}
	)
}
function $t(t, n) {
	const e = {},
		o = {},
		r = { $$scope: 1 }
	let s = t.length
	for (; s--; ) {
		const c = t[s],
			i = n[s]
		if (i) {
			for (const t in c) t in i || (o[t] = 1)
			for (const t in i) r[t] || ((e[t] = i[t]), (r[t] = 1))
			t[s] = i
		} else for (const t in c) r[t] = 1
	}
	for (const c in o) c in e || (e[c] = void 0)
	return e
}
function gt(t) {
	return 'object' == typeof t && null !== t ? t : {}
}
function mt(t) {
	t && t.c()
}
function yt(t, n) {
	t && t.l(n)
}
function bt(t, n, e, r) {
	const { fragment: i, on_mount: u, on_destroy: a, after_update: f } = t.$$
	i && i.m(n, e),
		r ||
			Y(() => {
				const n = u.map(o).filter(c)
				a ? a.push(...n) : s(n), (t.$$.on_mount = [])
			}),
		f.forEach(Y)
}
function _t(t, n) {
	const e = t.$$
	null !== e.fragment &&
		(s(e.on_destroy),
		e.fragment && e.fragment.d(n),
		(e.on_destroy = e.fragment = null),
		(e.ctx = []))
}
function wt(t, n) {
	;-1 === t.$$.dirty[0] && (K.push(t), X || ((X = !0), W.then(nt)), t.$$.dirty.fill(0)),
		(t.$$.dirty[(n / 31) | 0] |= 1 << n % 31)
}
function vt(n, e, o, c, i, u, a = [-1]) {
	const f = z
	T(n)
	const l = (n.$$ = {
		fragment: null,
		ctx: null,
		props: u,
		update: t,
		not_equal: i,
		bound: r(),
		on_mount: [],
		on_destroy: [],
		on_disconnect: [],
		before_update: [],
		after_update: [],
		context: new Map(f ? f.$$.context : e.context || []),
		callbacks: r(),
		dirty: a,
		skip_bound: !1,
	})
	let d = !1
	if (
		((l.ctx = o
			? o(n, e.props || {}, (t, e, ...o) => {
					const r = o.length ? o[0] : e
					return (
						l.ctx &&
							i(l.ctx[t], (l.ctx[t] = r)) &&
							(!l.skip_bound && l.bound[t] && l.bound[t](r), d && wt(n, t)),
						e
					)
			  })
			: []),
		l.update(),
		(d = !0),
		s(l.before_update),
		(l.fragment = !!c && c(l.ctx)),
		e.target)
	) {
		if (e.hydrate) {
			const t = A(e.target)
			l.fragment && l.fragment.l(t), t.forEach(w)
		} else l.fragment && l.fragment.c()
		e.intro && ft(n.$$.fragment), bt(n, e.target, e.anchor, e.customElement), nt()
	}
	T(f)
}
class xt {
	$destroy() {
		_t(this, 1), (this.$destroy = t)
	}
	$on(t, n) {
		const e = this.$$.callbacks[t] || (this.$$.callbacks[t] = [])
		return (
			e.push(n),
			() => {
				const t = e.indexOf(n)
				;-1 !== t && e.splice(t, 1)
			}
		)
	}
	$set(t) {
		var n
		this.$$set &&
			((n = t), 0 !== Object.keys(n).length) &&
			((this.$$.skip_bound = !0), this.$$set(t), (this.$$.skip_bound = !1))
	}
}
const kt = []
function Et(n, e = t) {
	let o
	const r = []
	function s(t) {
		if (i(n, t) && ((n = t), o)) {
			const t = !kt.length
			for (let e = 0; e < r.length; e += 1) {
				const t = r[e]
				t[1](), kt.push(t, n)
			}
			if (t) {
				for (let t = 0; t < kt.length; t += 2) kt[t][0](kt[t + 1])
				kt.length = 0
			}
		}
	}
	return {
		set: s,
		update: function (t) {
			s(t(n))
		},
		subscribe: function (c, i = t) {
			const u = [c, i]
			return (
				r.push(u),
				1 === r.length && (o = e(s) || t),
				c(n),
				() => {
					const t = r.indexOf(u)
					;-1 !== t && r.splice(t, 1), 0 === r.length && (o(), (o = null))
				}
			)
		},
	}
}
function Ot(t) {
	const n = t - 1
	return n * n * n + 1
}
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */ function jt(
	t
) {
	var { fallback: n } = t,
		o = (function (t, n) {
			var e = {}
			for (var o in t)
				Object.prototype.hasOwnProperty.call(t, o) && n.indexOf(o) < 0 && (e[o] = t[o])
			if (null != t && 'function' == typeof Object.getOwnPropertySymbols) {
				var r = 0
				for (o = Object.getOwnPropertySymbols(t); r < o.length; r++)
					n.indexOf(o[r]) < 0 &&
						Object.prototype.propertyIsEnumerable.call(t, o[r]) &&
						(e[o[r]] = t[o[r]])
			}
			return e
		})(t, ['fallback'])
	const r = new Map(),
		s = new Map()
	function i(t, r, s) {
		return (i, u) => (
			t.set(u.key, { rect: i.getBoundingClientRect() }),
			() => {
				if (r.has(u.key)) {
					const { rect: t } = r.get(u.key)
					return (
						r.delete(u.key),
						(function (t, n, r) {
							const {
									delay: s = 0,
									duration: i = (t) => 30 * Math.sqrt(t),
									easing: u = Ot,
								} = e(e({}, o), r),
								a = n.getBoundingClientRect(),
								f = t.left - a.left,
								l = t.top - a.top,
								d = t.width / a.width,
								h = t.height / a.height,
								p = Math.sqrt(f * f + l * l),
								$ = getComputedStyle(n),
								g = 'none' === $.transform ? '' : $.transform,
								m = +$.opacity
							return {
								delay: s,
								duration: c(i) ? i(p) : i,
								easing: u,
								css: (t, n) =>
									`\n\t\t\t\topacity: ${
										t * m
									};\n\t\t\t\ttransform-origin: top left;\n\t\t\t\ttransform: ${g} translate(${
										n * f
									}px,${n * l}px) scale(${t + (1 - t) * d}, ${
										t + (1 - t) * h
									});\n\t\t\t`,
							}
						})(t, i, u)
					)
				}
				return t.delete(u.key), n && n(i, u, s)
			}
		)
	}
	return [i(s, r, !1), i(r, s, !0)]
}
export {
	e as A,
	ut as B,
	Et as C,
	a as D,
	l as E,
	b as F,
	t as G,
	J as H,
	q as I,
	Y as J,
	ht as K,
	pt as L,
	v as M,
	u as N,
	jt as O,
	d as P,
	N as Q,
	xt as S,
	A as a,
	j as b,
	C as c,
	w as d,
	x as e,
	_ as f,
	S as g,
	P as h,
	vt as i,
	mt as j,
	E as k,
	O as l,
	yt as m,
	M as n,
	bt as o,
	$t as p,
	gt as q,
	lt as r,
	i as s,
	k as t,
	at as u,
	ft as v,
	_t as w,
	H as x,
	G as y,
	L as z,
}
