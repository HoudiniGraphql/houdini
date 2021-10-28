import {
	S as s,
	i as a,
	s as o,
	e as t,
	k as e,
	t as i,
	c as r,
	n as h,
	a as c,
	g as n,
	d as g,
	b as l,
	f as u,
	F as d,
	G as f,
} from '../chunks/vendor-be35de2e.js'
function m(s) {
	let a, o, m, p, b
	return {
		c() {
			;(a = t('img')), (m = e()), (p = t('a')), (b = i('Docs')), this.h()
		},
		l(s) {
			;(a = r(s, 'IMG', { src: !0, alt: !0, height: !0 })),
				(m = h(s)),
				(p = r(s, 'A', { href: !0 }))
			var o = c(p)
			;(b = n(o, 'Docs')), o.forEach(g), this.h()
		},
		h() {
			a.src !== (o = '/images/logo.png') && l(a, 'src', '/images/logo.png'),
				l(a, 'alt', 'Houdini logo. Looks like a hat with rabbit ears coming out of it'),
				l(a, 'height', '200'),
				l(p, 'href', '/docs')
		},
		m(s, o) {
			u(s, a, o), u(s, m, o), u(s, p, o), d(p, b)
		},
		p: f,
		i: f,
		o: f,
		d(s) {
			s && g(a), s && g(m), s && g(p)
		},
	}
}
export default class extends s {
	constructor(s) {
		super(), a(this, s, null, m, o, {})
	}
}
