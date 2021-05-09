import Root from '../../generated/root.svelte';
import { routes, fallback } from '../../generated/manifest.js';
import { g as get_base_uri } from '../chunks/utils.js';
import { writable } from 'svelte/store';
import { init } from './singletons.js';
import { set_paths } from '../paths.js';

function scroll_state() {
	return {
		x: pageXOffset,
		y: pageYOffset
	};
}

/**
 * @param {Node} node
 * @returns {HTMLAnchorElement | SVGAElement}
 */
function find_anchor(node) {
	while (node && node.nodeName.toUpperCase() !== 'A') node = node.parentNode; // SVG <a> elements have a lowercase name
	return /** @type {HTMLAnchorElement | SVGAElement} */ (node);
}

class Router {
	/** @param {{
	 *    base: string;
	 *    routes: import('types.internal').CSRRoute[];
	 * }} opts */
	constructor({ base, routes }) {
		this.base = base;
		this.routes = routes;
	}

	/** @param {import('./renderer').Renderer} renderer */
	init(renderer) {
		/** @type {import('./renderer').Renderer} */
		this.renderer = renderer;
		renderer.router = this;

		this.enabled = true;

		if ('scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}

		// Adopted from Nuxt.js
		// Reset scrollRestoration to auto when leaving page, allowing page reload
		// and back-navigation from other pages to use the browser to restore the
		// scrolling position.
		addEventListener('beforeunload', () => {
			history.scrollRestoration = 'auto';
		});

		// Setting scrollRestoration to manual again when returning to this page.
		addEventListener('load', () => {
			history.scrollRestoration = 'manual';
		});

		// There's no API to capture the scroll location right before the user
		// hits the back/forward button, so we listen for scroll events

		/** @type {NodeJS.Timeout} */
		let scroll_timer;
		addEventListener('scroll', () => {
			clearTimeout(scroll_timer);
			scroll_timer = setTimeout(() => {
				// Store the scroll location in the history
				// This will persist even if we navigate away from the site and come back
				const new_state = {
					...(history.state || {}),
					'sveltekit:scroll': scroll_state()
				};
				history.replaceState(new_state, document.title, window.location.href);
			}, 50);
		});

		/** @param {MouseEvent} event */
		const trigger_prefetch = (event) => {
			const a = find_anchor(/** @type {Node} */ (event.target));
			if (a && a.hasAttribute('sveltekit:prefetch')) {
				this.prefetch(new URL(/** @type {string} */ (a.href)));
			}
		};

		/** @type {NodeJS.Timeout} */
		let mousemove_timeout;

		/** @param {MouseEvent} event */
		const handle_mousemove = (event) => {
			clearTimeout(mousemove_timeout);
			mousemove_timeout = setTimeout(() => {
				trigger_prefetch(event);
			}, 20);
		};

		addEventListener('touchstart', trigger_prefetch);
		addEventListener('mousemove', handle_mousemove);

		/** @param {MouseEvent} event */
		addEventListener('click', (event) => {
			if (!this.enabled) return;

			// Adapted from https://github.com/visionmedia/page.js
			// MIT license https://github.com/visionmedia/page.js#license
			if (event.button || event.which !== 1) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			if (event.defaultPrevented) return;

			const a = find_anchor(/** @type {Node} */ (event.target));
			if (!a) return;

			if (!a.href) return;

			// check if link is inside an svg
			// in this case, both href and target are always inside an object
			const svg = typeof a.href === 'object' && a.href.constructor.name === 'SVGAnimatedString';
			const href = String(svg ? /** @type {SVGAElement} */ (a).href.baseVal : a.href);

			if (href === location.href) {
				if (!location.hash) event.preventDefault();
				return;
			}

			// Ignore if tag has
			// 1. 'download' attribute
			// 2. rel='external' attribute
			if (a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;

			// Ignore if <a> has a target
			if (svg ? /** @type {SVGAElement} */ (a).target.baseVal : a.target) return;

			const url = new URL(href);

			// Don't handle hash changes
			if (url.pathname === location.pathname && url.search === location.search) return;

			const info = this.parse(url);
			if (info) {
				const noscroll = a.hasAttribute('sveltekit:noscroll');
				history.pushState({}, '', url.href);
				this._navigate(info, noscroll ? scroll_state() : null, [], url.hash);
				event.preventDefault();
			}
		});

		addEventListener('popstate', (event) => {
			if (event.state && this.enabled) {
				const url = new URL(location.href);
				const info = this.parse(url);
				if (info) {
					this._navigate(info, event.state['sveltekit:scroll'], []);
				} else {
					// eslint-disable-next-line
					location.href = location.href; // nosonar
				}
			}
		});

		// make it possible to reset focus
		document.body.setAttribute('tabindex', '-1');

		// create initial history entry, so we can return here
		history.replaceState(history.state || {}, '', location.href);
	}

	/**
	 * @param {URL} url
	 * @returns {import('./types').NavigationInfo}
	 */
	parse(url) {
		if (url.origin !== location.origin) return null;
		if (!url.pathname.startsWith(this.base)) return null;

		const path = url.pathname.slice(this.base.length) || '/';

		const routes = this.routes.filter(([pattern]) => pattern.test(path));

		if (routes.length > 0) {
			const query = new URLSearchParams(url.search);
			const id = `${path}?${query}`;

			return { id, routes, path, query };
		}
	}

	/**
	 * @param {string} href
	 * @param {{ noscroll?: boolean, replaceState?: boolean }} opts
	 * @param {string[]} chain
	 */
	async goto(href, { noscroll = false, replaceState = false } = {}, chain) {
		if (this.enabled) {
			const url = new URL(href, get_base_uri(document));
			const info = this.parse(url);

			if (info) {
				// TODO shouldn't need to pass the hash here
				history[replaceState ? 'replaceState' : 'pushState']({}, '', href);
				return this._navigate(info, noscroll ? scroll_state() : null, chain, url.hash);
			}
		}

		location.href = href;
		return new Promise(() => {
			/* never resolves */
		});
	}

	enable() {
		this.enabled = true;
	}

	disable() {
		this.enabled = false;
	}

	/**
	 * @param {URL} url
	 * @returns {Promise<import('./types').NavigationResult>}
	 */
	async prefetch(url) {
		const info = this.parse(url);

		if (info) {
			return this.renderer.load(info);
		} else {
			throw new Error(`Could not prefetch ${url.href}`);
		}
	}

	/**
	 * @param {import('./types').NavigationInfo} info
	 * @param {{ x: number, y: number }} scroll
	 * @param {string[]} chain
	 * @param {string} [hash]
	 */
	async _navigate(info, scroll, chain, hash) {
		this.renderer.notify({
			path: info.path,
			query: info.query
		});

		// remove trailing slashes
		if (location.pathname.endsWith('/') && location.pathname !== '/') {
			history.replaceState({}, '', `${location.pathname.slice(0, -1)}${location.search}`);
		}

		await this.renderer.update(info, chain);

		document.body.focus();

		const deep_linked = hash && document.getElementById(hash.slice(1));
		if (scroll) {
			scrollTo(scroll.x, scroll.y);
		} else if (deep_linked) {
			// scroll is an element id (from a hash), we need to compute y
			scrollTo(0, deep_linked.getBoundingClientRect().top + scrollY);
		} else {
			scrollTo(0, 0);
		}
	}
}

/**
 * @param {import('../../types.internal').LoadOutput} loaded
 * @returns {import('../../types.internal').LoadOutput}
 */
function normalize(loaded) {
	// TODO should this behaviour be dev-only?

	if (loaded.error) {
		const error = typeof loaded.error === 'string' ? new Error(loaded.error) : loaded.error;
		const status = loaded.status;

		if (!(error instanceof Error)) {
			return {
				status: 500,
				error: new Error(
					`"error" property returned from load() must be a string or instance of Error, received type "${typeof error}"`
				)
			};
		}

		if (!status || status < 400 || status > 599) {
			console.warn('"error" returned from load() without a valid status code — defaulting to 500');
			return { status: 500, error };
		}

		return { status, error };
	}

	if (loaded.redirect) {
		if (!loaded.status || Math.floor(loaded.status / 100) !== 3) {
			return {
				status: 500,
				error: new Error(
					'"redirect" property returned from load() must be accompanied by a 3xx status code'
				)
			};
		}

		if (typeof loaded.redirect !== 'string') {
			return {
				status: 500,
				error: new Error('"redirect" property returned from load() must be a string')
			};
		}
	}

	return loaded;
}

/** @param {any} value */
function page_store(value) {
	const store = writable(value);
	let ready = true;

	function notify() {
		ready = true;
		store.update((val) => val);
	}

	/** @param {any} new_value */
	function set(new_value) {
		ready = false;
		store.set(new_value);
	}

	/** @param {(value: any) => void} run */
	function subscribe(run) {
		/** @type {any} */
		let old_value;
		return store.subscribe((new_value) => {
			if (old_value === undefined || (ready && new_value !== old_value)) {
				run((old_value = new_value));
			}
		});
	}

	return { notify, set, subscribe };
}

/**
 * @param {RequestInfo} resource
 * @param {RequestInit} opts
 */
function initial_fetch(resource, opts) {
	const url = typeof resource === 'string' ? resource : resource.url;
	const script = document.querySelector(`script[type="svelte-data"][url="${url}"]`);
	if (script) {
		const { body, ...init } = JSON.parse(script.textContent);
		return Promise.resolve(new Response(body, init));
	}

	return fetch(resource, opts);
}

/** @typedef {import('types.internal').CSRComponent} CSRComponent */

class Renderer {
	/** @param {{
	 *   Root: CSRComponent;
	 *   fallback: [CSRComponent, CSRComponent];
	 *   target: Node;
	 *   session: any;
	 *   host: string;
	 * }} opts */
	constructor({ Root, fallback, target, session, host }) {
		this.Root = Root;
		this.fallback = fallback;
		this.host = host;

		/** @type {import('./router').Router} */
		this.router = null;

		this.target = target;

		this.started = false;

		this.session_id = 1;

		/** @type {import('./types').NavigationState} */
		this.current = {
			page: null,
			session_id: null,
			branch: []
		};

		/** @type {Map<string, import('./types').NavigationResult>} */
		this.cache = new Map();

		this.loading = {
			id: null,
			promise: null
		};

		this.stores = {
			page: page_store({}),
			navigating: writable(null),
			session: writable(session)
		};

		this.$session = null;

		this.root = null;

		let ready = false;
		this.stores.session.subscribe(async (value) => {
			this.$session = value;

			if (!ready) return;
			this.session_id += 1;

			const info = this.router.parse(new URL(location.href));
			this.update(info, []);
		});
		ready = true;
	}

	/**
	 * @param {{
	 *   status: number;
	 *   error: Error;
	 *   nodes: Array<Promise<CSRComponent>>;
	 *   page: import('types').Page;
	 * }} selected
	 */
	async start({ status, error, nodes, page }) {
		/** @type {import('./types').BranchNode[]} */
		const branch = [];

		/** @type {Record<string, any>} */
		let context = {};

		/** @type {import('./types').NavigationResult} */
		let result;

		/** @type {number} */
		let new_status;

		/** @type {Error} new_error */
		let new_error;

		try {
			for (let i = 0; i < nodes.length; i += 1) {
				const is_leaf = i === nodes.length - 1;

				const node = await this._load_node({
					module: await nodes[i],
					page,
					context,
					status: is_leaf && status,
					error: is_leaf && error
				});

				branch.push(node);

				if (node && node.loaded) {
					if (node.loaded.error) {
						if (error) throw node.loaded.error;
						new_status = node.loaded.status;
						new_error = node.loaded.error;
					} else if (node.loaded.context) {
						context = {
							...context,
							...node.loaded.context
						};
					}
				}
			}

			result = await this._get_navigation_result_from_branch({ page, branch });
		} catch (e) {
			if (error) throw e;

			new_status = 500;
			new_error = e;
		}

		if (new_error) {
			result = await this._load_error({
				status: new_status,
				error: new_error,
				path: page.path,
				query: page.query
			});
		}

		if (result.redirect) {
			// this is a real edge case — `load` would need to return
			// a redirect but only in the browser
			location.href = new URL(result.redirect, location.href).href;
			return;
		}

		this._init(result);
	}

	/** @param {{ path: string, query: URLSearchParams }} destination */
	notify({ path, query }) {
		dispatchEvent(new CustomEvent('sveltekit:navigation-start'));

		if (this.started) {
			this.stores.navigating.set({
				from: {
					path: this.current.page.path,
					query: this.current.page.query
				},
				to: {
					path,
					query
				}
			});
		}
	}

	/**
	 * @param {import('./types').NavigationInfo} info
	 * @param {string[]} chain
	 */
	async update(info, chain) {
		const token = (this.token = {});
		let navigation_result = await this._get_navigation_result(info);

		// abort if user navigated during update
		if (token !== this.token) return;

		if (navigation_result.redirect) {
			if (chain.length > 10 || chain.includes(info.path)) {
				navigation_result = await this._load_error({
					status: 500,
					error: new Error('Redirect loop'),
					path: info.path,
					query: info.query
				});
			} else {
				if (this.router) {
					this.router.goto(navigation_result.redirect, { replaceState: true }, [
						...chain,
						info.path
					]);
				} else {
					location.href = new URL(navigation_result.redirect, location.href).href;
				}

				return;
			}
		}

		if (navigation_result.reload) {
			location.reload();
		} else if (this.started) {
			this.current = navigation_result.state;

			this.root.$set(navigation_result.props);
			this.stores.navigating.set(null);

			await 0;
		} else {
			this._init(navigation_result);
		}

		dispatchEvent(new CustomEvent('sveltekit:navigation-end'));
		this.loading.promise = null;
		this.loading.id = null;

		const leaf_node = navigation_result.state.branch[navigation_result.state.branch.length - 1];
		if (leaf_node && leaf_node.module.router === false) {
			this.router.disable();
		} else {
			this.router.enable();
		}
	}

	/**
	 * @param {import('./types').NavigationInfo} info
	 * @returns {Promise<import('./types').NavigationResult>}
	 */
	load(info) {
		this.loading.promise = this._get_navigation_result(info);
		this.loading.id = info.id;

		return this.loading.promise;
	}

	/** @param {import('./types').NavigationResult} result */
	_init(result) {
		this.current = result.state;

		const style = document.querySelector('style[data-svelte]');
		if (style) style.remove();

		this.root = new this.Root({
			target: this.target,
			props: {
				stores: this.stores,
				...result.props
			},
			hydrate: true
		});

		this.started = true;
	}

	/**
	 * @param {import('./types').NavigationInfo} info
	 * @returns {Promise<import('./types').NavigationResult>}
	 */
	async _get_navigation_result(info) {
		if (this.loading.id === info.id) {
			return this.loading.promise;
		}

		for (let i = 0; i < info.routes.length; i += 1) {
			const route = info.routes[i];

			if (route.length === 1) {
				return { reload: true };
			}

			// load code for subsequent routes immediately, if they are as
			// likely to match the current path/query as the current one
			let j = i + 1;
			while (j < info.routes.length) {
				const next = info.routes[j];
				if (next[0].toString() === route[0].toString()) {
					if (next.length !== 1) next[1].forEach((loader) => loader());
					j += 1;
				} else {
					break;
				}
			}

			const result = await this._load({ route, path: info.path, query: info.query });
			if (result) return result;
		}

		return await this._load_error({
			status: 404,
			error: new Error(`Not found: ${info.path}`),
			path: info.path,
			query: info.query
		});
	}

	/**
	 *
	 * @param {{
	 *   page: import('types').Page;
	 *   branch: import('./types').BranchNode[]
	 * }} opts
	 */
	async _get_navigation_result_from_branch({ page, branch }) {
		const filtered = branch.filter(Boolean);

		/** @type {import('./types').NavigationResult} */
		const result = {
			state: {
				page,
				branch,
				session_id: this.session_id
			},
			props: {
				components: filtered.map((node) => node.module.default)
			}
		};

		for (let i = 0; i < filtered.length; i += 1) {
			if (filtered[i].loaded) result.props[`props_${i}`] = await filtered[i].loaded.props;
		}

		if (
			!this.current.page ||
			page.path !== this.current.page.path ||
			page.query.toString() !== this.current.page.query.toString()
		) {
			result.props.page = page;
		}

		const leaf = filtered[filtered.length - 1];
		const maxage = leaf.loaded && leaf.loaded.maxage;

		if (maxage) {
			const hash = `${page.path}?${page.query}`;
			let ready = false;

			const clear = () => {
				if (this.cache.get(hash) === result) {
					this.cache.delete(hash);
				}

				unsubscribe();
				clearTimeout(timeout);
			};

			const timeout = setTimeout(clear, maxage * 1000);

			const unsubscribe = this.stores.session.subscribe(() => {
				if (ready) clear();
			});

			ready = true;

			this.cache.set(hash, result);
		}

		return result;
	}

	/**
	 *
	 * @param {{
	 *   status?: number;
	 *   error?: Error;
	 *   module: CSRComponent;
	 *   page: import('types').Page;
	 *   context: Record<string, any>;
	 * }} options
	 * @returns
	 */
	async _load_node({ status, error, module, page, context }) {
		/** @type {import('./types').BranchNode} */
		const node = {
			module,
			uses: {
				params: new Set(),
				path: false,
				query: false,
				session: false,
				context: false
			},
			loaded: null,
			context
		};

		/** @type {Record<string, string>} */
		const params = {};
		for (const key in page.params) {
			Object.defineProperty(params, key, {
				get() {
					node.uses.params.add(key);
					return page.params[key];
				},
				enumerable: true
			});
		}

		const session = this.$session;

		if (module.load) {
			/** @type {import('types.internal').LoadInput | import('types.internal').ErrorLoadInput} */
			const load_input = {
				page: {
					host: page.host,
					params,
					get path() {
						node.uses.path = true;
						return page.path;
					},
					get query() {
						node.uses.query = true;
						return page.query;
					}
				},
				get session() {
					node.uses.session = true;
					return session;
				},
				get context() {
					node.uses.context = true;
					return { ...context };
				},
				fetch: this.started ? fetch : initial_fetch
			};

			if (error) {
				/** @type {import('types.internal').ErrorLoadInput} */ (load_input).status = status;
				/** @type {import('types.internal').ErrorLoadInput} */ (load_input).error = error;
			}

			const loaded = await module.load.call(null, load_input);

			// if the page component returns nothing from load, fall through
			if (!loaded) return;

			node.loaded = normalize(loaded);
			if (node.loaded.context) node.context = node.loaded.context;
		}

		return node;
	}

	/**
	 * @param {import('./types').NavigationCandidate} selected
	 * @returns {Promise<import('./types').NavigationResult>}
	 */
	async _load({ route, path, query }) {
		const hash = `${path}?${query}`;

		if (this.cache.has(hash)) {
			return this.cache.get(hash);
		}

		const [pattern, a, b, get_params] = route;
		const params = get_params ? get_params(pattern.exec(path)) : {};

		const changed = this.current.page && {
			path: path !== this.current.page.path,
			params: Object.keys(params).filter((key) => this.current.page.params[key] !== params[key]),
			query: query.toString() !== this.current.page.query.toString(),
			session: this.session_id !== this.current.session_id
		};

		/** @type {import('types').Page} */
		const page = { host: this.host, path, query, params };

		/** @type {import('./types').BranchNode[]} */
		const branch = [];

		/** @type {Record<string, any>} */
		let context = {};
		let context_changed = false;

		/** @type {number} */
		let status = 200;

		/** @type {Error} */
		let error = null;

		// preload modules
		a.forEach((loader) => loader());

		load: for (let i = 0; i < a.length; i += 1) {
			/** @type {import('./types').BranchNode} */
			let node;

			try {
				if (!a[i]) continue;

				const module = await a[i]();
				const previous = this.current.branch[i];

				const changed_since_last_render =
					!previous ||
					module !== previous.module ||
					(changed.path && previous.uses.path) ||
					changed.params.some((param) => previous.uses.params.has(param)) ||
					(changed.query && previous.uses.query) ||
					(changed.session && previous.uses.session) ||
					(context_changed && previous.uses.context);

				if (changed_since_last_render) {
					node = await this._load_node({
						module,
						page,
						context
					});

					const is_leaf = i === a.length - 1;

					if (node && node.loaded) {
						if (node.loaded.error) {
							status = node.loaded.status;
							error = node.loaded.error;
						}

						if (node.loaded.redirect) {
							return {
								redirect: node.loaded.redirect
							};
						}

						if (node.loaded.context) {
							context_changed = true;
						}
					} else if (is_leaf && module.load) {
						// if the leaf node has a `load` function
						// that returns nothing, fall through
						return;
					}
				} else {
					node = previous;
				}
			} catch (e) {
				status = 500;
				error = e;
			}

			if (error) {
				while (i--) {
					if (b[i]) {
						let error_loaded;

						/** @type {import('./types').BranchNode} */
						let node_loaded;
						let j = i;
						while (!(node_loaded = branch[j])) {
							j -= 1;
						}

						try {
							error_loaded = await this._load_node({
								status,
								error,
								module: await b[i](),
								page,
								context: node_loaded.context
							});

							if (error_loaded.loaded.error) {
								continue;
							}

							branch.push(error_loaded);
							break load;
						} catch (e) {
							continue;
						}
					}
				}

				return await this._load_error({
					status,
					error,
					path,
					query
				});
			} else {
				if (node && node.loaded && node.loaded.context) {
					context = {
						...context,
						...node.loaded.context
					};
				}

				branch.push(node);
			}
		}

		return await this._get_navigation_result_from_branch({ page, branch });
	}

	/**
	 * @param {{
	 *   status: number;
	 *   error: Error;
	 *   path: string;
	 *   query: URLSearchParams
	 * }} opts
	 */
	async _load_error({ status, error, path, query }) {
		const page = {
			host: this.host,
			path,
			query,
			params: {}
		};

		const node = await this._load_node({
			module: await this.fallback[0],
			page,
			context: {}
		});

		const branch = [
			node,
			await this._load_node({
				status,
				error,
				module: await this.fallback[1],
				page,
				context: node && node.loaded && node.loaded.context
			})
		];

		return await this._get_navigation_result_from_branch({ page, branch });
	}
}

// @ts-ignore

/** @param {{
 *   paths: {
 *     assets: string;
 *     base: string;
 *   },
 *   target: Node;
 *   session: any;
 *   host: string;
 *   route: boolean;
 *   spa: boolean;
 *   hydrate: {
 *     status: number;
 *     error: Error;
 *     nodes: Array<Promise<import('types.internal').CSRComponent>>;
 *     page: import('types').Page;
 *   };
 * }} opts */
async function start({ paths, target, session, host, route, spa, hydrate }) {
	const router =
		route &&
		new Router({
			base: paths.base,
			routes
		});

	const renderer = new Renderer({
		Root,
		fallback,
		target,
		session,
		host
	});

	init(router);
	set_paths(paths);

	if (hydrate) await renderer.start(hydrate);
	if (route) router.init(renderer);

	if (spa) router.goto(location.href, { replaceState: true }, []);

	dispatchEvent(new CustomEvent('sveltekit:start'));
}

if (import.meta.env.VITE_SVELTEKIT_SERVICE_WORKER) {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register(import.meta.env.VITE_SVELTEKIT_SERVICE_WORKER);
	}
}

export { start };
