import {
	S as s,
	i as a,
	s as t,
	A as n,
	j as e,
	m as o,
	o as r,
	p as i,
	q as c,
	v as l,
	r as d,
	w as p,
	P as u,
	e as h,
	t as f,
	k as $,
	c as m,
	a as g,
	g as v,
	d as b,
	n as x,
	b as E,
	f as H,
	F as j,
	G as k,
} from '../../chunks/vendor-be35de2e.js'
import { D as y } from '../../chunks/Docs.layout-3b38f4d9.js'
function D(s) {
	let a, t, n, e, o, r, i
	return {
		c() {
			;(a = h('h1')),
				(t = f('Installation')),
				(n = $()),
				(e = h('p')),
				(o = f('Houdini is available on npm.')),
				(r = $()),
				(i = h('pre')),
				this.h()
		},
		l(s) {
			a = m(s, 'H1', {})
			var c = g(a)
			;(t = v(c, 'Installation')), c.forEach(b), (n = x(s)), (e = m(s, 'P', {}))
			var l = g(e)
			;(o = v(l, 'Houdini is available on npm.')),
				l.forEach(b),
				(r = x(s)),
				(i = m(s, 'PRE', { class: !0 })),
				g(i).forEach(b),
				this.h()
		},
		h() {
			E(i, 'class', 'language-sh')
		},
		m(s, c) {
			H(s, a, c),
				j(a, t),
				H(s, n, c),
				H(s, e, c),
				j(e, o),
				H(s, r, c),
				H(s, i, c),
				(i.innerHTML =
					'<code class="language-sh">yarn add -D houdini houdini-preprocess\n# or\nnpm install --save-dev houdini houdini-preprocess</code>')
		},
		p: k,
		d(s) {
			s && b(a), s && b(n), s && b(e), s && b(r), s && b(i)
		},
	}
}
function I(s) {
	let a, t
	const u = [s[0], P]
	let h = { $$slots: { default: [D] }, $$scope: { ctx: s } }
	for (let e = 0; e < u.length; e += 1) h = n(h, u[e])
	return (
		(a = new y({ props: h })),
		{
			c() {
				e(a.$$.fragment)
			},
			l(s) {
				o(a.$$.fragment, s)
			},
			m(s, n) {
				r(a, s, n), (t = !0)
			},
			p(s, [t]) {
				const n = 1 & t ? i(u, [1 & t && c(s[0]), 0 & t && c(P)]) : {}
				2 & t && (n.$$scope = { dirty: t, ctx: s }), a.$set(n)
			},
			i(s) {
				t || (l(a.$$.fragment, s), (t = !0))
			},
			o(s) {
				d(a.$$.fragment, s), (t = !1)
			},
			d(s) {
				p(a, s)
			},
		}
	)
}
const P = { title: 'Getting Started', description: 'Installation' }
function w(s, a, t) {
	return (
		(s.$$set = (s) => {
			t(0, (a = n(n({}, a), u(s))))
		}),
		[(a = u(a))]
	)
}
export default class extends s {
	constructor(s) {
		super(), a(this, s, w, I, t, {})
	}
}
export { P as metadata }
