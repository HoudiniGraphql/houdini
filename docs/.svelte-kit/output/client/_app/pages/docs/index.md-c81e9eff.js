import {
	S as e,
	i as a,
	s as t,
	A as o,
	j as r,
	m as i,
	o as s,
	p as n,
	q as l,
	v as c,
	r as p,
	w as d,
	P as h,
	e as f,
	t as u,
	k as m,
	c as v,
	a as b,
	g,
	d as y,
	n as S,
	f as $,
	F as L,
} from '../../chunks/vendor-be35de2e.js'
import { D as w } from '../../chunks/Docs.layout-3b38f4d9.js'
function E(e) {
	let a, t, o, r, i, s, n, l, c, p, d, h, w, E, G, k, x, I, q, P, Q, z, K, j, A, H, T
	return {
		c() {
			;(a = f('h1')),
				(t = u('Houdini')),
				(o = m()),
				(r = f('p')),
				(i = u('The disappearing GraphQL client for Sapper and SvelteKit.')),
				(s = m()),
				(n = f('ul')),
				(l = f('li')),
				(c = u('Composable and colocated data requirements for your components')),
				(p = m()),
				(d = f('li')),
				(h = u('Normalized cache with declarative updates')),
				(w = m()),
				(E = f('li')),
				(G = u('Generated types')),
				(k = m()),
				(x = f('li')),
				(I = u('Subscriptions')),
				(q = m()),
				(P = f('li')),
				(Q = u('Support for SvelteKit and Sapper')),
				(z = m()),
				(K = f('li')),
				(j = u('Pagination (cursors and offsets)')),
				(A = m()),
				(H = f('p')),
				(T = u(
					'At its core, houdini seeks to enable a high quality developer experience without compromising bundle size. Like Svelte, houdini shifts what is traditionally handled by a bloated runtime into a compile step that allows for the generation of an incredibly lean GraphQL abstraction for your application.'
				))
		},
		l(e) {
			a = v(e, 'H1', {})
			var f = b(a)
			;(t = g(f, 'Houdini')), f.forEach(y), (o = S(e)), (r = v(e, 'P', {}))
			var u = b(r)
			;(i = g(u, 'The disappearing GraphQL client for Sapper and SvelteKit.')),
				u.forEach(y),
				(s = S(e)),
				(n = v(e, 'UL', {}))
			var m = b(n)
			l = v(m, 'LI', {})
			var $ = b(l)
			;(c = g($, 'Composable and colocated data requirements for your components')),
				$.forEach(y),
				(p = S(m)),
				(d = v(m, 'LI', {}))
			var L = b(d)
			;(h = g(L, 'Normalized cache with declarative updates')),
				L.forEach(y),
				(w = S(m)),
				(E = v(m, 'LI', {}))
			var C = b(E)
			;(G = g(C, 'Generated types')), C.forEach(y), (k = S(m)), (x = v(m, 'LI', {}))
			var D = b(x)
			;(I = g(D, 'Subscriptions')), D.forEach(y), (q = S(m)), (P = v(m, 'LI', {}))
			var N = b(P)
			;(Q = g(N, 'Support for SvelteKit and Sapper')),
				N.forEach(y),
				(z = S(m)),
				(K = v(m, 'LI', {}))
			var F = b(K)
			;(j = g(F, 'Pagination (cursors and offsets)')),
				F.forEach(y),
				m.forEach(y),
				(A = S(e)),
				(H = v(e, 'P', {}))
			var U = b(H)
			;(T = g(
				U,
				'At its core, houdini seeks to enable a high quality developer experience without compromising bundle size. Like Svelte, houdini shifts what is traditionally handled by a bloated runtime into a compile step that allows for the generation of an incredibly lean GraphQL abstraction for your application.'
			)),
				U.forEach(y)
		},
		m(e, f) {
			$(e, a, f),
				L(a, t),
				$(e, o, f),
				$(e, r, f),
				L(r, i),
				$(e, s, f),
				$(e, n, f),
				L(n, l),
				L(l, c),
				L(n, p),
				L(n, d),
				L(d, h),
				L(n, w),
				L(n, E),
				L(E, G),
				L(n, k),
				L(n, x),
				L(x, I),
				L(n, q),
				L(n, P),
				L(P, Q),
				L(n, z),
				L(n, K),
				L(K, j),
				$(e, A, f),
				$(e, H, f),
				L(H, T)
		},
		d(e) {
			e && y(a), e && y(o), e && y(r), e && y(s), e && y(n), e && y(A), e && y(H)
		},
	}
}
function G(e) {
	let a, t
	const h = [e[0], k]
	let f = { $$slots: { default: [E] }, $$scope: { ctx: e } }
	for (let r = 0; r < h.length; r += 1) f = o(f, h[r])
	return (
		(a = new w({ props: f })),
		{
			c() {
				r(a.$$.fragment)
			},
			l(e) {
				i(a.$$.fragment, e)
			},
			m(e, o) {
				s(a, e, o), (t = !0)
			},
			p(e, [t]) {
				const o = 1 & t ? n(h, [1 & t && l(e[0]), 0 & t && l(k)]) : {}
				2 & t && (o.$$scope = { dirty: t, ctx: e }), a.$set(o)
			},
			i(e) {
				t || (c(a.$$.fragment, e), (t = !0))
			},
			o(e) {
				p(a.$$.fragment, e), (t = !1)
			},
			d(e) {
				d(a, e)
			},
		}
	)
}
const k = {
	title: 'Getting Started',
	description: 'The "disappearing" GraphQL client for the Svelte ecosystem',
}
function x(e, a, t) {
	return (
		(e.$$set = (e) => {
			t(0, (a = o(o({}, a), h(e))))
		}),
		[(a = h(a))]
	)
}
export default class extends e {
	constructor(e) {
		super(), a(this, e, x, G, t, {})
	}
}
export { k as metadata }
