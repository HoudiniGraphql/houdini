import {
	S as t,
	i as e,
	s as n,
	D as o,
	e as s,
	k as a,
	Q as c,
	c as i,
	d as r,
	n as l,
	a as d,
	b as p,
	F as m,
	f as u,
	E as h,
	v as $,
	r as f,
} from './vendor-be35de2e.js'
function E(t) {
	let e, n, E, v, y, A, M, T
	document.title = v = t[0]
	const b = t[3].default,
		g = o(b, t, t[2], null)
	return {
		c() {
			;(e = s('meta')),
				(n = s('meta')),
				(E = s('meta')),
				(y = a()),
				(A = s('main')),
				(M = s('article')),
				g && g.c(),
				this.h()
		},
		l(t) {
			const o = c('[data-svelte="svelte-133lmyd"]', document.head)
			;(e = i(o, 'META', { name: !0, content: !0 })),
				(n = i(o, 'META', { property: !0, content: !0 })),
				(E = i(o, 'META', { property: !0, content: !0 })),
				o.forEach(r),
				(y = l(t)),
				(A = i(t, 'MAIN', {}))
			var s = d(A)
			M = i(s, 'ARTICLE', {})
			var a = d(M)
			g && g.l(a), a.forEach(r), s.forEach(r), this.h()
		},
		h() {
			p(e, 'name', 'description'),
				p(e, 'content', t[1]),
				p(n, 'property', 'og:description'),
				p(n, 'content', t[1]),
				p(E, 'property', 'og:title'),
				p(E, 'content', t[0])
		},
		m(t, o) {
			m(document.head, e),
				m(document.head, n),
				m(document.head, E),
				u(t, y, o),
				u(t, A, o),
				m(A, M),
				g && g.m(M, null),
				(T = !0)
		},
		p(t, [o]) {
			;(!T || 2 & o) && p(e, 'content', t[1]),
				(!T || 2 & o) && p(n, 'content', t[1]),
				(!T || 1 & o) && p(E, 'content', t[0]),
				(!T || 1 & o) && v !== (v = t[0]) && (document.title = v),
				g && g.p && (!T || 4 & o) && h(g, b, t, t[2], o, null, null)
		},
		i(t) {
			T || ($(g, t), (T = !0))
		},
		o(t) {
			f(g, t), (T = !1)
		},
		d(t) {
			r(e), r(n), r(E), t && r(y), t && r(A), g && g.d(t)
		},
	}
}
function v(t, e, n) {
	let { $$slots: o = {}, $$scope: s } = e,
		{ title: a } = e,
		{ description: c } = e
	return (
		(t.$$set = (t) => {
			'title' in t && n(0, (a = t.title)),
				'description' in t && n(1, (c = t.description)),
				'$$scope' in t && n(2, (s = t.$$scope))
		}),
		[a, c, s, o]
	)
}
class y extends t {
	constructor(t) {
		super(), e(this, t, v, E, n, { title: 0, description: 1 })
	}
}
export { y as D }
