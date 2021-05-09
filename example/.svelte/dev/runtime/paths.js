/** @type {string} */
let base = '';

/** @type {string} */
let assets = '/.';

/** @param {{ base: string, assets: string }} paths */
function set_paths(paths) {
	({ base, assets } = paths);
}

export { assets, base, set_paths };
