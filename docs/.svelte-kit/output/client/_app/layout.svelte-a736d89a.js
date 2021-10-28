import { S as s, i as e, s as t, D as n, E as l, v as o, r as c } from './chunks/vendor-be35de2e.js'
function r(s) {
	let e
	const t = s[1].default,
		r = n(t, s, s[0], null)
	return {
		c() {
			r && r.c()
		},
		l(s) {
			r && r.l(s)
		},
		m(s, t) {
			r && r.m(s, t), (e = !0)
		},
		p(s, [n]) {
			r && r.p && (!e || 1 & n) && l(r, t, s, s[0], n, null, null)
		},
		i(s) {
			e || (o(r, s), (e = !0))
		},
		o(s) {
			c(r, s), (e = !1)
		},
		d(s) {
			r && r.d(s)
		},
	}
}
function u(s, e, t) {
	let { $$slots: n = {}, $$scope: l } = e
	return (
		(s.$$set = (s) => {
			'$$scope' in s && t(0, (l = s.$$scope))
		}),
		[l, n]
	)
}
export default class extends s {
	constructor(s) {
		super(), e(this, s, u, r, t, {})
	}
}
