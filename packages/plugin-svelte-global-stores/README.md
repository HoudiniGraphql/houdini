<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/HoudiniGraphql/houdini/main/.github/assets/logo_l.svg">
    <img height="140" alt="Houdini's logo (dark or light)" src="https://raw.githubusercontent.com/HoudiniGraphql/houdini/main/.github/assets/logo_d.svg">
  </picture>
  <br />
  <br />
  <strong>
    The disappearing GraphQL clients.
  </strong>
  <br />
  <br />
  <a href="https://npmjs.org/package/houdini-plugin-svelte-global-stores">
    <img src="https://img.shields.io/npm/v/houdini.svg" alt="version" />
  </a>
  <a href="https://github.com/HoudiniGraphql/houdini/actions">
    <img src="https://github.com/HoudiniGraphql/houdini/actions/workflows/tests.yml/badge.svg" alt="CI Tests" />
  </a>
  <a href="https://github.com/HoudiniGraphql/houdini">
    <img src="https://img.shields.io/github/stars/HoudiniGraphql/houdini.svg?label=stars" alt="github stars" />
  </a>
  <a href="https://npmjs.org/package/houdini">
    <img src="https://img.shields.io/npm/dm/houdini.svg" alt="downloads" />
  </a>
  <a href="https://github.com/HoudiniGraphql/houdini/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/HoudiniGraphql/houdini.svg?maxAge=2592000" alt="license" />
  </a>
</div>

---

# ➕ houdini-plugin-svelte-global-stores

This package provides global stores for houdini's svelte bindings.

## Setup

To use this plugin, add it to the list of plugins in `houdini.config.js`:

```js
/// <references types="houdini-svelte">
/// <references types="houdini-plugin-svelte-global-stores">

/** @type {import('houdini').ConfigFile} */
const config = {

  plugins: {
    'houdini-plugin-svelte-global-stores': {
      prefix: 'GQL_',
      generate: ['mutation', 'subscription', 'fragment']
    },
    'houdini-svelte': {}
  }

};

export default config;

```

The following configuration options are available:
- `prefix` (optional, default: `GQL_`): The default prefix of your global stores. This lets your editor provide autocompletion with just a few characters.
- `generate` (optional, default: `['mutation', 'subscription', 'fragment']`). Note that by default, 'Query' is omitted on purpose. You can also pass `"all"` to generate all stores.


## Usage

This plugin allows you to import a globally accesible store for your external documents. It's important to be careful
when using global stores on the server since it can result in data leaking across requests.

```graphql
# src/lib/queries/MyAwesomeQuery.gql

query MyAwesomeQuery {
	viewer {
		isAwesome
	}
}
```

```typescript
// src/routes/myRoute/+page.js
import { GQL_MyAwesomeQuery } from '$houdini'
```

Note the prefix `GQL_` is to enable easy autocompletion in your editor - give it a try!

## Generating Loads For Stores

You can now tell the houdini plugin to generate loads for your stores. To do this, you need to export a `houdini_load` variable from your `+page.js/ts` file:

```typescript
// src/routes/myProfile/+page.ts

import { GQL_MyQuery, GQL_Query1, GQL_Query2 } from '$houdini'

export const houdini_load = GQL_MyQuery
// or
export const houdini_load = [GQL_Query1, GQL_Query2]
```

### Fragments example

Fragments stores can be created from your external documents by using the `.get` method on the global store in `$houdini`:

```svelte
<script>
	import { GQL_UserAvatar } from '$houdini'

	// the reference will get passed as a prop
	export let user

	// load the the required UserAvatar for this component
	$: data = GQL_UserAvatar.get(user)
</script>

<img src={$data.profilePicture} />
```

### Endpoints

Using a query store inside of an endpoint looks very similar to the `load` function: just pass the event you
are handed in your route function:

```typescript
import { GQL_MyQuery } from '$houdini'

export async function get(event) {
	const { data } = await GQL_MyQuery.fetch({ event })

	return {
		body: {
			data
		}
	}
}
```

---

<a href="https://www.houdinigraphql.com">HoudiniGraphQL.com</a> 🚀
