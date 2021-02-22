# 🎩 houdini

The disappearing GraphQL client built for the Svelte community.

## ✨&nbsp;&nbsp;Features

-   Composable and colocated data requirements for your components
-   Document caching with declarative updates
-   Sapper/Sveltekit ready
-   Generated types
-   Customizable error handling (coming soon)

At its core, Houdini seeks to enable a high quality developer experience
without compromising runtime bundle size. Like Svelte, Houdini shifts what is
traditionally handled by a bloated runtime into a compile step that allows
for the generation of an incredibly lean GraphQL abstraction for your application.

## ⚡&nbsp;&nbsp;Example

A demo can be found in the <a href='./example'>example directory.</a>

## 🕹️&nbsp;&nbsp;Installation

Houdini is available on npm:

```sh
yarn add houdini houdini-tools
# or
npm install --save houdini houdini-tools
```

## 🔧 Configuring Your Environment

Setting up a new houdini project can easily be done with the provided command-line tool:

```sh
npx houdini-tools init
```

This will create a few necessary files as well as pull down a json representation of
your API's schema. Up next, add the preprocessor to your sapper/sveltekit setup. Don't
forget to add it to both the client and the server configurations!

```typescript
import { preprocess as houdini } from 'houdini-tools'

// somewhere in your config file
{
	plugins: [
		svelte({
			preprocess: houdini(),
		}),
	]
}
```

With that in place, the only thing left is to configure your client and server environments
to use the generated starting point for your network layer:

```typescript
// in both src/client.js and src/server.js

import { setEnvironment } from 'houdini'
import env from './environment'

setEnvironment(env)
```

## 🚀 Fetching Data
 
Grabbing data from your API is done simply with the `query` function:

```svelte
<script lang="ts">
	import { query, graphql } from 'houdini'
	import type { AllItems } from '../../generated'

	// load the items
	const data = query<AllItems>(graphql`
		query AllItems {
			items {
				id
				text
			}
		}
	`)
</script>

{#each $data.items as item (item.id)}
	<div>{item.text}</div>
{/each}

```

### ❓  What about `preload`?

Don't worry - that's where the preprocessor comes in. One of its responsbilities is moving the actual 
fetch into a `preload`. You can think of the above block as being equivalent to:

```svelte
<script lang="ts" context="module">
	import fetch from 'fetch
	
	return {
	   _initialValue: await fetchQuery({text: queryString }),
	}
</script>

<script lang="ts">
    	export let _initialValue

    	const data = readable(_initialValue, ...)
</script>

{#each $data.items as item (item.id)}
	<div>{item.text}</div>
{/each}
```
