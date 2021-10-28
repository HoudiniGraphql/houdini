import {
	H as s,
	S as a,
	i as e,
	s as t,
	e as r,
	k as l,
	t as n,
	c,
	a as o,
	n as i,
	g as h,
	d as f,
	b as v,
	I as u,
	f as d,
	F as g,
	v as p,
	J as m,
	K as w,
	L as b,
	B as E,
	r as $,
	u as z,
	M as I,
	N as D,
	O as V,
	D as k,
	j as x,
	m as y,
	o as A,
	E as L,
	w as S,
} from '../../chunks/vendor-be35de2e.js'
const M = {
	subscribe: (a) =>
		(() => {
			const a = s('__svelte__')
			return {
				page: { subscribe: a.page.subscribe },
				navigating: { subscribe: a.navigating.subscribe },
				get preloading() {
					return (
						console.error(
							'stores.preloading is deprecated; use stores.navigating instead'
						),
						{ subscribe: a.navigating.subscribe }
					)
				},
				session: a.session,
			}
		})().page.subscribe(a),
}
function _(s, a, e) {
	const t = s.slice()
	return (t[5] = a[e].href), (t[6] = a[e].name), t
}
function B(s, a, e) {
	const t = s.slice()
	return (t[5] = a[e].href), (t[6] = a[e].name), t
}
function H(s) {
	let a, e, t, l, n
	return {
		c() {
			;(a = r('div')), (e = r('div')), this.h()
		},
		l(s) {
			a = c(s, 'DIV', { class: !0 })
			var t = o(a)
			;(e = c(t, 'DIV', { class: !0 })), o(e).forEach(f), t.forEach(f), this.h()
		},
		h() {
			v(e, 'class', 'arrow arrow-small svelte-tvzawr'),
				v(a, 'class', 'arrow-wrapper svelte-tvzawr')
		},
		m(s, t) {
			d(s, a, t), g(a, e), (n = !0)
		},
		i(e) {
			n ||
				(m(() => {
					l && l.end(1), t || (t = w(a, s[2], { key: 'a' })), t.start()
				}),
				(n = !0))
		},
		o(e) {
			t && t.invalidate(), (l = b(a, s[1], { key: 'a' })), (n = !1)
		},
		d(s) {
			s && f(a), s && l && l.end()
		},
	}
}
function j(s) {
	let a,
		e,
		t,
		m,
		w,
		b = s[6] + '',
		I = s[5] === s[0].path && H(s)
	return {
		c() {
			;(a = r('li')), I && I.c(), (e = l()), (t = r('a')), (m = n(b)), this.h()
		},
		l(s) {
			a = c(s, 'LI', { class: !0 })
			var r = o(a)
			I && I.l(r), (e = i(r)), (t = c(r, 'A', { href: !0, tabindex: !0, class: !0 }))
			var l = o(t)
			;(m = h(l, b)), l.forEach(f), r.forEach(f), this.h()
		},
		h() {
			v(t, 'href', s[5]),
				v(t, 'tabindex', '0'),
				v(t, 'class', 'svelte-tvzawr'),
				v(a, 'class', 'svelte-tvzawr'),
				u(a, 'selected', s[5] === s[0].path)
		},
		m(s, r) {
			d(s, a, r), I && I.m(a, null), g(a, e), g(a, t), g(t, m), (w = !0)
		},
		p(s, t) {
			s[5] === s[0].path
				? I
					? 1 & t && p(I, 1)
					: ((I = H(s)), I.c(), p(I, 1), I.m(a, e))
				: I &&
				  (E(),
				  $(I, 1, 1, () => {
						I = null
				  }),
				  z()),
				9 & t && u(a, 'selected', s[5] === s[0].path)
		},
		i(s) {
			w || (p(I), (w = !0))
		},
		o(s) {
			$(I), (w = !1)
		},
		d(s) {
			s && f(a), I && I.d()
		},
	}
}
function G(s) {
	let a, e, t, l, n
	return {
		c() {
			;(a = r('div')), (e = r('div')), this.h()
		},
		l(s) {
			a = c(s, 'DIV', { class: !0 })
			var t = o(a)
			;(e = c(t, 'DIV', { class: !0 })), o(e).forEach(f), t.forEach(f), this.h()
		},
		h() {
			v(e, 'class', 'arrow arrow-small svelte-tvzawr'),
				v(a, 'class', 'arrow-wrapper svelte-tvzawr')
		},
		m(s, t) {
			d(s, a, t), g(a, e), (n = !0)
		},
		i(e) {
			n ||
				(m(() => {
					l && l.end(1), t || (t = w(a, s[2], { key: 'a' })), t.start()
				}),
				(n = !0))
		},
		o(e) {
			t && t.invalidate(), (l = b(a, s[1], { key: 'a' })), (n = !1)
		},
		d(s) {
			s && f(a), s && l && l.end()
		},
	}
}
function N(s) {
	let a,
		e,
		t,
		m,
		w,
		b,
		I = s[6] + '',
		D = s[5] === s[0].path && G(s)
	return {
		c() {
			;(a = r('li')), D && D.c(), (e = l()), (t = r('a')), (m = n(I)), (w = l()), this.h()
		},
		l(s) {
			a = c(s, 'LI', { class: !0 })
			var r = o(a)
			D && D.l(r), (e = i(r)), (t = c(r, 'A', { href: !0, tabindex: !0, class: !0 }))
			var l = o(t)
			;(m = h(l, I)), l.forEach(f), (w = i(r)), r.forEach(f), this.h()
		},
		h() {
			v(t, 'href', s[5]),
				v(t, 'tabindex', '0'),
				v(t, 'class', 'svelte-tvzawr'),
				v(a, 'class', 'svelte-tvzawr'),
				u(a, 'selected', s[5] === s[0].path)
		},
		m(s, r) {
			d(s, a, r), D && D.m(a, null), g(a, e), g(a, t), g(t, m), g(a, w), (b = !0)
		},
		p(s, t) {
			s[5] === s[0].path
				? D
					? 1 & t && p(D, 1)
					: ((D = G(s)), D.c(), p(D, 1), D.m(a, e))
				: D &&
				  (E(),
				  $(D, 1, 1, () => {
						D = null
				  }),
				  z()),
				17 & t && u(a, 'selected', s[5] === s[0].path)
		},
		i(s) {
			b || (p(D), (b = !0))
		},
		o(s) {
			$(D), (b = !1)
		},
		d(s) {
			s && f(a), D && D.d()
		},
	}
}
function R(s) {
	let a,
		e,
		t,
		n,
		h,
		u,
		m,
		w,
		b,
		D,
		V,
		k,
		x,
		y,
		A,
		L,
		S,
		M = s[3],
		H = []
	for (let r = 0; r < M.length; r += 1) H[r] = j(B(s, M, r))
	const G = (s) =>
		$(H[s], 1, 1, () => {
			H[s] = null
		})
	let R = s[4],
		U = []
	for (let r = 0; r < R.length; r += 1) U[r] = N(_(s, R, r))
	const C = (s) =>
		$(U[s], 1, 1, () => {
			U[s] = null
		})
	return {
		c() {
			;(a = r('aside')),
				(e = r('details')),
				(t = r('summary')),
				(n = r('div')),
				(h = r('div')),
				(u = l()),
				(m = r('div')),
				(w = r('div')),
				(b = r('img')),
				(V = l()),
				(k = r('nav')),
				(x = r('ul'))
			for (let s = 0; s < H.length; s += 1) H[s].c()
			;(y = l()), (A = r('hr')), (L = l())
			for (let s = 0; s < U.length; s += 1) U[s].c()
			this.h()
		},
		l(s) {
			a = c(s, 'ASIDE', { class: !0 })
			var r = o(a)
			e = c(r, 'DETAILS', { open: !0, class: !0 })
			var l = o(e)
			t = c(l, 'SUMMARY', { class: !0 })
			var v = o(t)
			n = c(v, 'DIV', { class: !0 })
			var d = o(n)
			;(h = c(d, 'DIV', { class: !0 })),
				o(h).forEach(f),
				d.forEach(f),
				v.forEach(f),
				(u = i(l)),
				(m = c(l, 'DIV', { class: !0 }))
			var g = o(m)
			w = c(g, 'DIV', { class: !0 })
			var p = o(w)
			;(b = c(p, 'IMG', { src: !0, height: !0, alt: !0 })),
				p.forEach(f),
				(V = i(g)),
				(k = c(g, 'NAV', {}))
			var E = o(k)
			x = c(E, 'UL', {})
			var $ = o(x)
			for (let a = 0; a < H.length; a += 1) H[a].l($)
			;(y = i($)), (A = c($, 'HR', { class: !0 })), (L = i($))
			for (let a = 0; a < U.length; a += 1) U[a].l($)
			$.forEach(f), E.forEach(f), g.forEach(f), l.forEach(f), r.forEach(f), this.h()
		},
		h() {
			v(h, 'class', 'arrow arrow-large svelte-tvzawr'),
				v(n, 'class', 'summary-arrow-wrapper svelte-tvzawr'),
				v(t, 'class', 'svelte-tvzawr'),
				b.src !== (D = '/images/logo.png') && v(b, 'src', '/images/logo.png'),
				v(b, 'height', '70'),
				v(b, 'alt', 'Houdini logo. Looks like a hat with rabbit ears coming out of it'),
				v(w, 'class', 'header svelte-tvzawr'),
				v(A, 'class', 'svelte-tvzawr'),
				v(m, 'class', 'scroll-area svelte-tvzawr'),
				(e.open = !0),
				v(e, 'class', 'svelte-tvzawr'),
				v(a, 'class', 'svelte-tvzawr')
		},
		m(s, r) {
			d(s, a, r),
				g(a, e),
				g(e, t),
				g(t, n),
				g(n, h),
				g(e, u),
				g(e, m),
				g(m, w),
				g(w, b),
				g(m, V),
				g(m, k),
				g(k, x)
			for (let a = 0; a < H.length; a += 1) H[a].m(x, null)
			g(x, y), g(x, A), g(x, L)
			for (let a = 0; a < U.length; a += 1) U[a].m(x, null)
			S = !0
		},
		p(s, [a]) {
			if (9 & a) {
				let e
				for (M = s[3], e = 0; e < M.length; e += 1) {
					const t = B(s, M, e)
					H[e]
						? (H[e].p(t, a), p(H[e], 1))
						: ((H[e] = j(t)), H[e].c(), p(H[e], 1), H[e].m(x, y))
				}
				for (E(), e = M.length; e < H.length; e += 1) G(e)
				z()
			}
			if (17 & a) {
				let e
				for (R = s[4], e = 0; e < R.length; e += 1) {
					const t = _(s, R, e)
					U[e]
						? (U[e].p(t, a), p(U[e], 1))
						: ((U[e] = N(t)), U[e].c(), p(U[e], 1), U[e].m(x, null))
				}
				for (E(), e = R.length; e < U.length; e += 1) C(e)
				z()
			}
		},
		i(s) {
			if (!S) {
				for (let s = 0; s < M.length; s += 1) p(H[s])
				for (let s = 0; s < R.length; s += 1) p(U[s])
				S = !0
			}
		},
		o(s) {
			H = H.filter(Boolean)
			for (let a = 0; a < H.length; a += 1) $(H[a])
			U = U.filter(Boolean)
			for (let a = 0; a < U.length; a += 1) $(U[a])
			S = !1
		},
		d(s) {
			s && f(a), I(H, s), I(U, s)
		},
	}
}
function U(s, a, e) {
	let t
	D(s, M, (s) => e(0, (t = s)))
	const [r, l] = V({})
	return [
		t,
		r,
		l,
		[
			{ name: 'Getting Started', href: '/docs' },
			{ name: 'Installation', href: '/docs/installation' },
		],
		[{ name: 'Contributing', href: '/docs/contributing' }],
	]
}
class C extends a {
	constructor(s) {
		super(), e(this, s, U, R, t, {})
	}
}
function F(s) {
	let a, e, t, n
	e = new C({})
	const h = s[1].default,
		u = k(h, s, s[0], null)
	return {
		c() {
			;(a = r('div')), x(e.$$.fragment), (t = l()), u && u.c(), this.h()
		},
		l(s) {
			a = c(s, 'DIV', { class: !0 })
			var r = o(a)
			y(e.$$.fragment, r), (t = i(r)), u && u.l(r), r.forEach(f), this.h()
		},
		h() {
			v(a, 'class', 'wrapper')
		},
		m(s, r) {
			d(s, a, r), A(e, a, null), g(a, t), u && u.m(a, null), (n = !0)
		},
		p(s, [a]) {
			u && u.p && (!n || 1 & a) && L(u, h, s, s[0], a, null, null)
		},
		i(s) {
			n || (p(e.$$.fragment, s), p(u, s), (n = !0))
		},
		o(s) {
			$(e.$$.fragment, s), $(u, s), (n = !1)
		},
		d(s) {
			s && f(a), S(e), u && u.d(s)
		},
	}
}
function J(s, a, e) {
	let { $$slots: t = {}, $$scope: r } = a
	return (
		(s.$$set = (s) => {
			'$$scope' in s && e(0, (r = s.$$scope))
		}),
		[r, t]
	)
}
export default class extends a {
	constructor(s) {
		super(), e(this, s, J, F, t, {})
	}
}
