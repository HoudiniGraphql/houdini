var t = Object.defineProperty,
	e = Object.defineProperties,
	r = Object.getOwnPropertyDescriptors,
	s = Object.getOwnPropertySymbols,
	n = Object.prototype.hasOwnProperty,
	a = Object.prototype.propertyIsEnumerable,
	o = (e, r, s) =>
		r in e ? t(e, r, { enumerable: !0, configurable: !0, writable: !0, value: s }) : (e[r] = s),
	i = (t, e) => {
		for (var r in e || (e = {})) n.call(e, r) && o(t, r, e[r])
		if (s) for (var r of s(e)) a.call(e, r) && o(t, r, e[r])
		return t
	}
import {
	S as l,
	i as c,
	s as u,
	e as d,
	c as h,
	a as p,
	d as f,
	b as g,
	f as m,
	t as _,
	g as y,
	h as $,
	j as v,
	k as b,
	l as w,
	m as x,
	n as E,
	o as q,
	p as R,
	q as L,
	r as S,
	u as k,
	v as O,
	w as P,
	x as j,
	y as T,
	z as U,
	A,
	B as N,
	C as I,
} from './chunks/vendor-be35de2e.js'
function C(t) {
	let e, r, s
	const n = [t[2] || {}]
	var a = t[0][1]
	function o(t) {
		let e = { $$slots: { default: [K] }, $$scope: { ctx: t } }
		for (let r = 0; r < n.length; r += 1) e = A(e, n[r])
		return { props: e }
	}
	return (
		a && (e = new a(o(t))),
		{
			c() {
				e && v(e.$$.fragment), (r = w())
			},
			l(t) {
				e && x(e.$$.fragment, t), (r = w())
			},
			m(t, n) {
				e && q(e, t, n), m(t, r, n), (s = !0)
			},
			p(t, s) {
				const i = 4 & s ? R(n, [L(t[2] || {})]) : {}
				if ((1049 & s && (i.$$scope = { dirty: s, ctx: t }), a !== (a = t[0][1]))) {
					if (e) {
						N()
						const t = e
						S(t.$$.fragment, 1, 0, () => {
							P(t, 1)
						}),
							k()
					}
					a
						? ((e = new a(o(t))),
						  v(e.$$.fragment),
						  O(e.$$.fragment, 1),
						  q(e, r.parentNode, r))
						: (e = null)
				} else a && e.$set(i)
			},
			i(t) {
				s || (e && O(e.$$.fragment, t), (s = !0))
			},
			o(t) {
				e && S(e.$$.fragment, t), (s = !1)
			},
			d(t) {
				t && f(r), e && P(e, t)
			},
		}
	)
}
function D(t) {
	let e, r, s
	const n = [t[3] || {}]
	var a = t[0][2]
	function o(t) {
		let e = { $$slots: { default: [B] }, $$scope: { ctx: t } }
		for (let r = 0; r < n.length; r += 1) e = A(e, n[r])
		return { props: e }
	}
	return (
		a && (e = new a(o(t))),
		{
			c() {
				e && v(e.$$.fragment), (r = w())
			},
			l(t) {
				e && x(e.$$.fragment, t), (r = w())
			},
			m(t, n) {
				e && q(e, t, n), m(t, r, n), (s = !0)
			},
			p(t, s) {
				const i = 8 & s ? R(n, [L(t[3] || {})]) : {}
				if ((1041 & s && (i.$$scope = { dirty: s, ctx: t }), a !== (a = t[0][2]))) {
					if (e) {
						N()
						const t = e
						S(t.$$.fragment, 1, 0, () => {
							P(t, 1)
						}),
							k()
					}
					a
						? ((e = new a(o(t))),
						  v(e.$$.fragment),
						  O(e.$$.fragment, 1),
						  q(e, r.parentNode, r))
						: (e = null)
				} else a && e.$set(i)
			},
			i(t) {
				s || (e && O(e.$$.fragment, t), (s = !0))
			},
			o(t) {
				e && S(e.$$.fragment, t), (s = !1)
			},
			d(t) {
				t && f(r), e && P(e, t)
			},
		}
	)
}
function V(t) {
	let e, r, s
	const n = [t[4] || {}]
	var a = t[0][3]
	function o(t) {
		let e = {}
		for (let r = 0; r < n.length; r += 1) e = A(e, n[r])
		return { props: e }
	}
	return (
		a && (e = new a(o())),
		{
			c() {
				e && v(e.$$.fragment), (r = w())
			},
			l(t) {
				e && x(e.$$.fragment, t), (r = w())
			},
			m(t, n) {
				e && q(e, t, n), m(t, r, n), (s = !0)
			},
			p(t, s) {
				const i = 16 & s ? R(n, [L(t[4] || {})]) : {}
				if (a !== (a = t[0][3])) {
					if (e) {
						N()
						const t = e
						S(t.$$.fragment, 1, 0, () => {
							P(t, 1)
						}),
							k()
					}
					a
						? ((e = new a(o())),
						  v(e.$$.fragment),
						  O(e.$$.fragment, 1),
						  q(e, r.parentNode, r))
						: (e = null)
				} else a && e.$set(i)
			},
			i(t) {
				s || (e && O(e.$$.fragment, t), (s = !0))
			},
			o(t) {
				e && S(e.$$.fragment, t), (s = !1)
			},
			d(t) {
				t && f(r), e && P(e, t)
			},
		}
	)
}
function B(t) {
	let e,
		r,
		s = t[0][3] && V(t)
	return {
		c() {
			s && s.c(), (e = w())
		},
		l(t) {
			s && s.l(t), (e = w())
		},
		m(t, n) {
			s && s.m(t, n), m(t, e, n), (r = !0)
		},
		p(t, r) {
			t[0][3]
				? s
					? (s.p(t, r), 1 & r && O(s, 1))
					: ((s = V(t)), s.c(), O(s, 1), s.m(e.parentNode, e))
				: s &&
				  (N(),
				  S(s, 1, 1, () => {
						s = null
				  }),
				  k())
		},
		i(t) {
			r || (O(s), (r = !0))
		},
		o(t) {
			S(s), (r = !1)
		},
		d(t) {
			s && s.d(t), t && f(e)
		},
	}
}
function K(t) {
	let e,
		r,
		s = t[0][2] && D(t)
	return {
		c() {
			s && s.c(), (e = w())
		},
		l(t) {
			s && s.l(t), (e = w())
		},
		m(t, n) {
			s && s.m(t, n), m(t, e, n), (r = !0)
		},
		p(t, r) {
			t[0][2]
				? s
					? (s.p(t, r), 1 & r && O(s, 1))
					: ((s = D(t)), s.c(), O(s, 1), s.m(e.parentNode, e))
				: s &&
				  (N(),
				  S(s, 1, 1, () => {
						s = null
				  }),
				  k())
		},
		i(t) {
			r || (O(s), (r = !0))
		},
		o(t) {
			S(s), (r = !1)
		},
		d(t) {
			s && s.d(t), t && f(e)
		},
	}
}
function W(t) {
	let e,
		r,
		s = t[0][1] && C(t)
	return {
		c() {
			s && s.c(), (e = w())
		},
		l(t) {
			s && s.l(t), (e = w())
		},
		m(t, n) {
			s && s.m(t, n), m(t, e, n), (r = !0)
		},
		p(t, r) {
			t[0][1]
				? s
					? (s.p(t, r), 1 & r && O(s, 1))
					: ((s = C(t)), s.c(), O(s, 1), s.m(e.parentNode, e))
				: s &&
				  (N(),
				  S(s, 1, 1, () => {
						s = null
				  }),
				  k())
		},
		i(t) {
			r || (O(s), (r = !0))
		},
		o(t) {
			S(s), (r = !1)
		},
		d(t) {
			s && s.d(t), t && f(e)
		},
	}
}
function z(t) {
	let e,
		r = t[6] && M(t)
	return {
		c() {
			;(e = d('div')), r && r.c(), this.h()
		},
		l(t) {
			e = h(t, 'DIV', { id: !0, 'aria-live': !0, 'aria-atomic': !0, class: !0 })
			var s = p(e)
			r && r.l(s), s.forEach(f), this.h()
		},
		h() {
			g(e, 'id', 'svelte-announcer'),
				g(e, 'aria-live', 'assertive'),
				g(e, 'aria-atomic', 'true'),
				g(e, 'class', 'svelte-1j55zn5')
		},
		m(t, s) {
			m(t, e, s), r && r.m(e, null)
		},
		p(t, s) {
			t[6] ? (r ? r.p(t, s) : ((r = M(t)), r.c(), r.m(e, null))) : r && (r.d(1), (r = null))
		},
		d(t) {
			t && f(e), r && r.d()
		},
	}
}
function M(t) {
	let e
	return {
		c() {
			e = _(t[7])
		},
		l(r) {
			e = y(r, t[7])
		},
		m(t, r) {
			m(t, e, r)
		},
		p(t, r) {
			128 & r && $(e, t[7])
		},
		d(t) {
			t && f(e)
		},
	}
}
function Y(t) {
	let e, r, s, n
	const a = [t[1] || {}]
	var o = t[0][0]
	function i(t) {
		let e = { $$slots: { default: [W] }, $$scope: { ctx: t } }
		for (let r = 0; r < a.length; r += 1) e = A(e, a[r])
		return { props: e }
	}
	o && (e = new o(i(t)))
	let l = t[5] && z(t)
	return {
		c() {
			e && v(e.$$.fragment), (r = b()), l && l.c(), (s = w())
		},
		l(t) {
			e && x(e.$$.fragment, t), (r = E(t)), l && l.l(t), (s = w())
		},
		m(t, a) {
			e && q(e, t, a), m(t, r, a), l && l.m(t, a), m(t, s, a), (n = !0)
		},
		p(t, [n]) {
			const c = 2 & n ? R(a, [L(t[1] || {})]) : {}
			if ((1053 & n && (c.$$scope = { dirty: n, ctx: t }), o !== (o = t[0][0]))) {
				if (e) {
					N()
					const t = e
					S(t.$$.fragment, 1, 0, () => {
						P(t, 1)
					}),
						k()
				}
				o
					? ((e = new o(i(t))),
					  v(e.$$.fragment),
					  O(e.$$.fragment, 1),
					  q(e, r.parentNode, r))
					: (e = null)
			} else o && e.$set(c)
			t[5]
				? l
					? l.p(t, n)
					: ((l = z(t)), l.c(), l.m(s.parentNode, s))
				: l && (l.d(1), (l = null))
		},
		i(t) {
			n || (e && O(e.$$.fragment, t), (n = !0))
		},
		o(t) {
			e && S(e.$$.fragment, t), (n = !1)
		},
		d(t) {
			e && P(e, t), t && f(r), l && l.d(t), t && f(s)
		},
	}
}
function G(t, e, r) {
	let { stores: s } = e,
		{ page: n } = e,
		{ components: a } = e,
		{ props_0: o = null } = e,
		{ props_1: i = null } = e,
		{ props_2: l = null } = e,
		{ props_3: c = null } = e
	j('__svelte__', s), T(s.page.notify)
	let u = !1,
		d = !1,
		h = null
	return (
		U(() => {
			const t = s.page.subscribe(() => {
				u && (r(6, (d = !0)), r(7, (h = document.title || 'untitled page')))
			})
			return r(5, (u = !0)), t
		}),
		(t.$$set = (t) => {
			'stores' in t && r(8, (s = t.stores)),
				'page' in t && r(9, (n = t.page)),
				'components' in t && r(0, (a = t.components)),
				'props_0' in t && r(1, (o = t.props_0)),
				'props_1' in t && r(2, (i = t.props_1)),
				'props_2' in t && r(3, (l = t.props_2)),
				'props_3' in t && r(4, (c = t.props_3))
		}),
		(t.$$.update = () => {
			768 & t.$$.dirty && s.page.set(n)
		}),
		[a, o, i, l, c, u, d, h, s, n]
	)
}
class J extends l {
	constructor(t) {
		super(),
			c(this, t, G, Y, u, {
				stores: 8,
				page: 9,
				components: 0,
				props_0: 1,
				props_1: 2,
				props_2: 3,
				props_3: 4,
			})
	}
}
let X
const F = {},
	H = function (t, e) {
		if (!e) return t()
		if (void 0 === X) {
			const t = document.createElement('link').relList
			X = t && t.supports && t.supports('modulepreload') ? 'modulepreload' : 'preload'
		}
		return Promise.all(
			e.map((t) => {
				if (t in F) return
				F[t] = !0
				const e = t.endsWith('.css'),
					r = e ? '[rel="stylesheet"]' : ''
				if (document.querySelector(`link[href="${t}"]${r}`)) return
				const s = document.createElement('link')
				return (
					(s.rel = e ? 'stylesheet' : X),
					e || ((s.as = 'script'), (s.crossOrigin = '')),
					(s.href = t),
					document.head.appendChild(s),
					e
						? new Promise((t, e) => {
								s.addEventListener('load', t), s.addEventListener('error', e)
						  })
						: void 0
				)
			})
		).then(() => t())
	},
	Q = [
		() =>
			H(() => import('./layout.svelte-a736d89a.js'), [
				'/_app/layout.svelte-a736d89a.js',
				'/_app/chunks/vendor-be35de2e.js',
			]),
		() =>
			H(() => import('./error.svelte-4385f0d9.js'), [
				'/_app/error.svelte-4385f0d9.js',
				'/_app/chunks/vendor-be35de2e.js',
			]),
		() =>
			H(() => import('./pages/index.svelte-bc7963b2.js'), [
				'/_app/pages/index.svelte-bc7963b2.js',
				'/_app/chunks/vendor-be35de2e.js',
			]),
		() =>
			H(() => import('./pages/docs/__layout.svelte-e4a92952.js'), [
				'/_app/pages/docs/__layout.svelte-e4a92952.js',
				'/_app/assets/pages/docs/__layout.svelte-3ca85a3a.css',
				'/_app/chunks/vendor-be35de2e.js',
			]),
		() =>
			H(() => import('./pages/docs/index.md-c81e9eff.js'), [
				'/_app/pages/docs/index.md-c81e9eff.js',
				'/_app/chunks/vendor-be35de2e.js',
				'/_app/chunks/Docs.layout-3b38f4d9.js',
				'/_app/assets/Docs.layout-339c9754.css',
			]),
		() =>
			H(() => import('./pages/docs/installation.md-3ad403ae.js'), [
				'/_app/pages/docs/installation.md-3ad403ae.js',
				'/_app/chunks/vendor-be35de2e.js',
				'/_app/chunks/Docs.layout-3b38f4d9.js',
				'/_app/assets/Docs.layout-339c9754.css',
			]),
	],
	Z = [
		[/^\/$/, [Q[0], Q[2]], [Q[1]]],
		[/^\/docs\/?$/, [Q[0], Q[3], Q[4]], [Q[1]]],
		[/^\/docs\/installation\/?$/, [Q[0], Q[3], Q[5]], [Q[1]]],
	],
	tt = [Q[0](), Q[1]()]
function et() {
	return { x: pageXOffset, y: pageYOffset }
}
function rt(t) {
	for (; t && 'A' !== t.nodeName.toUpperCase(); ) t = t.parentNode
	return t
}
class st {
	constructor({ base: t, routes: e, trailing_slash: r }) {
		;(this.base = t), (this.routes = e), (this.trailing_slash = r)
	}
	init(t) {
		let s
		;(this.renderer = t),
			(t.router = this),
			(this.enabled = !0),
			'scrollRestoration' in history && (history.scrollRestoration = 'manual'),
			addEventListener('beforeunload', () => {
				history.scrollRestoration = 'auto'
			}),
			addEventListener('load', () => {
				history.scrollRestoration = 'manual'
			}),
			addEventListener('scroll', () => {
				clearTimeout(s),
					(s = setTimeout(() => {
						const t =
							((s = i({}, history.state || {})),
							(n = { 'sveltekit:scroll': et() }),
							e(s, r(n)))
						var s, n
						history.replaceState(t, document.title, window.location.href)
					}, 50))
			})
		const n = (t) => {
			const e = rt(t.target)
			e && e.href && e.hasAttribute('sveltekit:prefetch') && this.prefetch(new URL(e.href))
		}
		let a
		addEventListener('touchstart', n),
			addEventListener('mousemove', (t) => {
				clearTimeout(a),
					(a = setTimeout(() => {
						n(t)
					}, 20))
			}),
			addEventListener('click', (t) => {
				var e
				if (!this.enabled) return
				if (t.button || 1 !== t.which) return
				if (t.metaKey || t.ctrlKey || t.shiftKey || t.altKey) return
				if (t.defaultPrevented) return
				const r = rt(t.target)
				if (!r) return
				if (!r.href) return
				const s =
						'object' == typeof r.href &&
						'SVGAnimatedString' === r.href.constructor.name,
					n = String(s ? r.href.baseVal : r.href)
				if (n === location.href) return void (location.hash || t.preventDefault())
				const a = null == (e = r.getAttribute('rel')) ? void 0 : e.split(/\s+/)
				if (r.hasAttribute('download') || (a && a.includes('external'))) return
				if (s ? r.target.baseVal : r.target) return
				const o = new URL(n)
				if (o.pathname === location.pathname && o.search === location.search) return
				const i = r.hasAttribute('sveltekit:noscroll')
				history.pushState({}, '', o.href),
					this._navigate(o, i ? et() : null, [], o.hash),
					t.preventDefault()
			}),
			addEventListener('popstate', (t) => {
				if (t.state && this.enabled) {
					const e = new URL(location.href)
					this._navigate(e, t.state['sveltekit:scroll'], [])
				}
			}),
			document.body.setAttribute('tabindex', '-1'),
			history.replaceState(history.state || {}, '', location.href)
	}
	parse(t) {
		if (t.origin !== location.origin) return null
		if (!t.pathname.startsWith(this.base)) return null
		const e = decodeURIComponent(t.pathname.slice(this.base.length) || '/'),
			r = this.routes.filter(([t]) => t.test(e)),
			s = new URLSearchParams(t.search)
		return { id: `${e}?${s}`, routes: r, path: e, query: s }
	}
	async goto(t, { noscroll: e = !1, replaceState: r = !1 } = {}, s) {
		if (this.enabled) {
			const n = new URL(
				t,
				(function (t) {
					let e = t.baseURI
					if (!e) {
						const r = t.getElementsByTagName('base')
						e = r.length ? r[0].href : t.URL
					}
					return e
				})(document)
			)
			return (
				history[r ? 'replaceState' : 'pushState']({}, '', t),
				this._navigate(n, e ? et() : null, s, n.hash)
			)
		}
		return (location.href = t), new Promise(() => {})
	}
	enable() {
		this.enabled = !0
	}
	disable() {
		this.enabled = !1
	}
	async prefetch(t) {
		return this.renderer.load(this.parse(t))
	}
	async _navigate(t, e, r, s) {
		const n = this.parse(t)
		if ('/' !== n.path) {
			const t = n.path.endsWith('/')
			;((t && 'never' === this.trailing_slash) ||
				(!t &&
					'always' === this.trailing_slash &&
					!n.path.split('/').pop().includes('.'))) &&
				((n.path = t ? n.path.slice(0, -1) : n.path + '/'),
				history.replaceState({}, '', `${n.path}${location.search}`))
		}
		this.renderer.notify({ path: n.path, query: n.query }),
			await this.renderer.update(n, r, !1),
			document.body.focus()
		const a = s && document.getElementById(s.slice(1))
		e
			? scrollTo(e.x, e.y)
			: a
			? scrollTo(0, a.getBoundingClientRect().top + scrollY)
			: scrollTo(0, 0)
	}
}
function nt(t) {
	const e = I(t)
	let r = !0
	return {
		notify: function () {
			;(r = !0), e.update((t) => t)
		},
		set: function (t) {
			;(r = !1), e.set(t)
		},
		subscribe: function (t) {
			let s
			return e.subscribe((e) => {
				;(void 0 === s || (r && e !== s)) && t((s = e))
			})
		},
	}
}
function at(t, e) {
	let r = `script[type="svelte-data"][url="${'string' == typeof t ? t : t.url}"]`
	e &&
		'string' == typeof e.body &&
		(r += `[body="${(function (t) {
			let e = 5381,
				r = t.length
			if ('string' == typeof t) for (; r; ) e = (33 * e) ^ t.charCodeAt(--r)
			else for (; r; ) e = (33 * e) ^ t[--r]
			return (e >>> 0).toString(36)
		})(e.body)}"]`)
	const o = document.querySelector(r)
	if (o) {
		const t = JSON.parse(o.textContent),
			{ body: e } = t,
			r = ((t, e) => {
				var r = {}
				for (var o in t) n.call(t, o) && e.indexOf(o) < 0 && (r[o] = t[o])
				if (null != t && s)
					for (var o of s(t)) e.indexOf(o) < 0 && a.call(t, o) && (r[o] = t[o])
				return r
			})(t, ['body'])
		return Promise.resolve(new Response(e, r))
	}
	return fetch(t, e)
}
class ot {
	constructor({ Root: t, fallback: e, target: r, session: s, host: n }) {
		;(this.Root = t),
			(this.fallback = e),
			(this.host = n),
			(this.router = null),
			(this.target = r),
			(this.started = !1),
			(this.session_id = 1),
			(this.invalid = new Set()),
			(this.invalidating = null),
			(this.current = { page: null, session_id: null, branch: [] }),
			(this.cache = new Map()),
			(this.loading = { id: null, promise: null }),
			(this.stores = { page: nt({}), navigating: I(null), session: I(s) }),
			(this.$session = null),
			(this.root = null)
		let a = !1
		this.stores.session.subscribe(async (t) => {
			if (((this.$session = t), !a)) return
			this.session_id += 1
			const e = this.router.parse(new URL(location.href))
			this.update(e, [], !0)
		}),
			(a = !0)
	}
	async start({ status: t, error: e, nodes: r, page: s }) {
		const n = []
		let a,
			o,
			l,
			c = {}
		try {
			for (let a = 0; a < r.length; a += 1) {
				const u = a === r.length - 1,
					d = await this._load_node({
						module: await r[a],
						page: s,
						context: c,
						status: u && t,
						error: u && e,
					})
				if ((n.push(d), d && d.loaded))
					if (d.loaded.error) {
						if (e) throw d.loaded.error
						;(o = d.loaded.status), (l = d.loaded.error)
					} else d.loaded.context && (c = i(i({}, c), d.loaded.context))
			}
			a = await this._get_navigation_result_from_branch({ page: s, branch: n })
		} catch (u) {
			if (e) throw u
			;(o = 500), (l = u)
		}
		l && (a = await this._load_error({ status: o, error: l, path: s.path, query: s.query })),
			a.redirect ? (location.href = new URL(a.redirect, location.href).href) : this._init(a)
	}
	notify({ path: t, query: e }) {
		dispatchEvent(new CustomEvent('sveltekit:navigation-start')),
			this.started &&
				this.stores.navigating.set({
					from: { path: this.current.page.path, query: this.current.page.query },
					to: { path: t, query: e },
				})
	}
	async update(t, e, r) {
		const s = (this.token = {})
		let n = await this._get_navigation_result(t, r)
		if (s !== this.token) return
		if ((this.invalid.clear(), n.redirect)) {
			if (!(e.length > 10 || e.includes(t.path)))
				return void (this.router
					? this.router.goto(n.redirect, { replaceState: !0 }, [...e, t.path])
					: (location.href = new URL(n.redirect, location.href).href))
			n = await this._load_error({
				status: 500,
				error: new Error('Redirect loop'),
				path: t.path,
				query: t.query,
			})
		}
		n.reload
			? location.reload()
			: this.started
			? ((this.current = n.state),
			  this.root.$set(n.props),
			  this.stores.navigating.set(null),
			  await 0)
			: this._init(n),
			dispatchEvent(new CustomEvent('sveltekit:navigation-end')),
			(this.loading.promise = null),
			(this.loading.id = null)
		const a = n.state.branch[n.state.branch.length - 1]
		a && !1 === a.module.router ? this.router.disable() : this.router.enable()
	}
	load(t) {
		return (
			(this.loading.promise = this._get_navigation_result(t, !1)),
			(this.loading.id = t.id),
			this.loading.promise
		)
	}
	invalidate(t) {
		return (
			this.invalid.add(t),
			this.invalidating ||
				(this.invalidating = Promise.resolve().then(async () => {
					const t = this.router.parse(new URL(location.href))
					await this.update(t, [], !0), (this.invalidating = null)
				})),
			this.invalidating
		)
	}
	_init(t) {
		this.current = t.state
		const e = document.querySelector('style[data-svelte]')
		e && e.remove(),
			(this.root = new this.Root({
				target: this.target,
				props: i({ stores: this.stores }, t.props),
				hydrate: !0,
			})),
			(this.started = !0)
	}
	async _get_navigation_result(t, e) {
		if (this.loading.id === t.id) return this.loading.promise
		for (let r = 0; r < t.routes.length; r += 1) {
			const s = t.routes[r]
			if (1 === s.length) return { reload: !0 }
			let n = r + 1
			for (; n < t.routes.length; ) {
				const e = t.routes[n]
				if (e[0].toString() !== s[0].toString()) break
				1 !== e.length && e[1].forEach((t) => t()), (n += 1)
			}
			const a = await this._load({ route: s, path: t.path, query: t.query }, e)
			if (a) return a
		}
		return await this._load_error({
			status: 404,
			error: new Error(`Not found: ${t.path}`),
			path: t.path,
			query: t.query,
		})
	}
	async _get_navigation_result_from_branch({ page: t, branch: e }) {
		const r = e.filter(Boolean),
			s = {
				state: { page: t, branch: e, session_id: this.session_id },
				props: { components: r.map((t) => t.module.default) },
			}
		for (let o = 0; o < r.length; o += 1)
			r[o].loaded && (s.props[`props_${o}`] = await r[o].loaded.props)
		;(this.current.page &&
			t.path === this.current.page.path &&
			t.query.toString() === this.current.page.query.toString()) ||
			(s.props.page = t)
		const n = r[r.length - 1],
			a = n.loaded && n.loaded.maxage
		if (a) {
			const e = `${t.path}?${t.query}`
			let r = !1
			const n = () => {
					this.cache.get(e) === s && this.cache.delete(e), i(), clearTimeout(o)
				},
				o = setTimeout(n, 1e3 * a),
				i = this.stores.session.subscribe(() => {
					r && n()
				})
			;(r = !0), this.cache.set(e, s)
		}
		return s
	}
	async _load_node({ status: t, error: e, module: r, page: s, context: n }) {
		const a = {
				module: r,
				uses: {
					params: new Set(),
					path: !1,
					query: !1,
					session: !1,
					context: !1,
					dependencies: [],
				},
				loaded: null,
				context: n,
			},
			o = {}
		for (const i in s.params)
			Object.defineProperty(o, i, {
				get: () => (a.uses.params.add(i), s.params[i]),
				enumerable: !0,
			})
		const l = this.$session
		if (r.load) {
			const { started: c } = this,
				u = {
					page: {
						host: s.host,
						params: o,
						get path() {
							return (a.uses.path = !0), s.path
						},
						get query() {
							return (a.uses.query = !0), s.query
						},
					},
					get session() {
						return (a.uses.session = !0), l
					},
					get context() {
						return (a.uses.context = !0), i({}, n)
					},
					fetch(t, e) {
						const r = 'string' == typeof t ? t : t.url,
							{ href: n } = new URL(r, new URL(s.path, document.baseURI))
						return a.uses.dependencies.push(n), c ? fetch(t, e) : at(t, e)
					},
				}
			e && ((u.status = t), (u.error = e))
			const d = await r.load.call(null, u)
			if (!d) return
			;(a.loaded = (function (t) {
				if (t.error) {
					const e = 'string' == typeof t.error ? new Error(t.error) : t.error,
						r = t.status
					return e instanceof Error
						? !r || r < 400 || r > 599
							? (console.warn(
									'"error" returned from load() without a valid status code — defaulting to 500'
							  ),
							  { status: 500, error: e })
							: { status: r, error: e }
						: {
								status: 500,
								error: new Error(
									`"error" property returned from load() must be a string or instance of Error, received type "${typeof e}"`
								),
						  }
				}
				if (t.redirect) {
					if (!t.status || 3 !== Math.floor(t.status / 100))
						return {
							status: 500,
							error: new Error(
								'"redirect" property returned from load() must be accompanied by a 3xx status code'
							),
						}
					if ('string' != typeof t.redirect)
						return {
							status: 500,
							error: new Error(
								'"redirect" property returned from load() must be a string'
							),
						}
				}
				return t
			})(d)),
				a.loaded.context && (a.context = a.loaded.context)
		}
		return a
	}
	async _load({ route: t, path: e, query: r }, s) {
		const n = `${e}?${r}`
		if (!s && this.cache.has(n)) return this.cache.get(n)
		const [a, o, l, c] = t,
			u = c ? c(a.exec(e)) : {},
			d = this.current.page && {
				path: e !== this.current.page.path,
				params: Object.keys(u).filter((t) => this.current.page.params[t] !== u[t]),
				query: r.toString() !== this.current.page.query.toString(),
				session: this.session_id !== this.current.session_id,
			},
			h = { host: this.host, path: e, query: r, params: u },
			p = []
		let f = {},
			g = !1,
			m = 200,
			_ = null
		o.forEach((t) => t())
		t: for (let $ = 0; $ < o.length; $ += 1) {
			let t
			try {
				if (!o[$]) continue
				const e = await o[$](),
					r = this.current.branch[$]
				if (
					!r ||
					e !== r.module ||
					(d.path && r.uses.path) ||
					d.params.some((t) => r.uses.params.has(t)) ||
					(d.query && r.uses.query) ||
					(d.session && r.uses.session) ||
					r.uses.dependencies.some((t) => this.invalid.has(t)) ||
					(g && r.uses.context)
				) {
					t = await this._load_node({ module: e, page: h, context: f })
					const r = $ === o.length - 1
					if (t && t.loaded) {
						if (
							(t.loaded.error && ((m = t.loaded.status), (_ = t.loaded.error)),
							t.loaded.redirect)
						)
							return { redirect: t.loaded.redirect }
						t.loaded.context && (g = !0)
					} else if (r && e.load) return
				} else t = r
			} catch (y) {
				;(m = 500), (_ = y)
			}
			if (_) {
				for (; $--; )
					if (l[$]) {
						let t,
							e,
							r = $
						for (; !(e = p[r]); ) r -= 1
						try {
							if (
								((t = await this._load_node({
									status: m,
									error: _,
									module: await l[$](),
									page: h,
									context: e.context,
								})),
								t.loaded.error)
							)
								continue
							p.push(t)
							break t
						} catch (y) {
							continue
						}
					}
				return await this._load_error({ status: m, error: _, path: e, query: r })
			}
			t && t.loaded && t.loaded.context && (f = i(i({}, f), t.loaded.context)), p.push(t)
		}
		return await this._get_navigation_result_from_branch({ page: h, branch: p })
	}
	async _load_error({ status: t, error: e, path: r, query: s }) {
		const n = { host: this.host, path: r, query: s, params: {} },
			a = await this._load_node({ module: await this.fallback[0], page: n, context: {} }),
			o = [
				a,
				await this._load_node({
					status: t,
					error: e,
					module: await this.fallback[1],
					page: n,
					context: a && a.loaded && a.loaded.context,
				}),
			]
		return await this._get_navigation_result_from_branch({ page: n, branch: o })
	}
}
async function it({
	paths: t,
	target: e,
	session: r,
	host: s,
	route: n,
	spa: a,
	trailing_slash: o,
	hydrate: i,
}) {
	const l = n && new st({ base: t.base, routes: Z, trailing_slash: o }),
		c = new ot({ Root: J, fallback: tt, target: e, session: r, host: s })
	i && (await c.start(i)),
		n && l.init(c),
		a && l.goto(location.href, { replaceState: !0 }, []),
		dispatchEvent(new CustomEvent('sveltekit:start'))
}
export { it as start }
