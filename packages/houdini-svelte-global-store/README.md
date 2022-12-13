<div align="center">
  <img alt="houdini" height="200" src="https://raw.githubusercontent.com/HoudiniGraphql/houdini/main/.github/assets/houdini-v5.png" />
  <br />
  <br />
  <strong>
    The disappearing GraphQL clients.
  </strong>
  <br />
  <br />
  <a href="https://npmjs.org/package/houdini-svelte-global-store">
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

# ➕ houdini-svelte-global-store

This package provides global stores for houdini's svelte bindings. 

## Setup

To be able to use this plugin, add it to the list of plugins in `houdini.config.js`, like so:
```js
/// <references types="houdini-svelte">
/// <references types="houdini-svelte-global-store">

/** @type {import('houdini').ConfigFile} */
const config = {
  
  plugins: {
    'houdini-svelte-global-store': {
      globalStorePrefix: 'GQL_'
    },
    'houdini-svelte': {}
  }

};

export default config;

```

One configuration option is available:
- `globalStorePrefix` (optional, default: `GQL_`): The default prefix of your global stores. This lets your editor provide autocompletion with just a few characters.


## Usage
### Basic Idea

External documents are pretty self explanatory: define your graphql documents a file (one definition per file) and then import your
store from `$houdini` as `GQL_MyAwesomeQuery`:

```graphql
# src/lib/queries/MyAwesomeQuery.gql

query MyAwesomeQuery {
	viewer {
		isAwesome
	}
}
```

```javascript
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

```javascript
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
