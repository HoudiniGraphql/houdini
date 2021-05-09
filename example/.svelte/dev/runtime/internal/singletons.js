/** @type {import('./router').Router} */
let router;

/** @type {string} */
let base = '';

/** @type {string} */
let assets = '/.';

/** @param {import('./router').Router} _ */
function init(_) {
	router = _;
}

/** @param {{ base: string, assets: string }} paths */
function set_paths(paths) {
	({ base, assets } = paths);
}

export { assets, base, init, router, set_paths };
