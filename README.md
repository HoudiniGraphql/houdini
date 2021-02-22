# 🎩 houdini

The disappearing GraphQL client built for Sapper and Sveltekit.

## ✨&nbsp;&nbsp;Features

-   Composable and colocated data requirements for your components
-   Document caching with declarative updates
-   Sapper/Sveltekit ready
-   Generated types
-   Customizable error handling (coming soon)

At its core, Houdini seeks to enable a high quality developer experience
without compromising bundle size. Like Svelte, Houdini shifts what is
traditionally handled by a bloated runtime into a compile step that allows
for the generation of an incredibly lean GraphQL abstraction for your application.

## 🕹️&nbsp;&nbsp;Example

A demo can be found in the <a href='./example'>example directory.</a>

## ⚡&nbsp;&nbsp;Installation

Houdini is available on npm:

```sh
yarn add houdini houdini-tools
# or
npm install --save houdini houdini-tools
```

## 🔧&nbsp;&nbsp;Configuring Your Environment

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
            preprocess: [houdini()],
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

## 🚀&nbsp;&nbsp;Fetching Data
 
Grabbing data from your API is done with the `query` function:

```svelte
<script lang="ts">
    import { query, graphql } from 'houdini'
    import type { AllItems } from '$generated'

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

{#each $data.items as item}
    <div>{item.text}</div>
{/each}

```

### Query variables and page data

At the moment, query variables are declared as a function in the module context of your component.
This function must be named after your query and takes the same `page` and `session` arguments
that are given to the `preload` function as described in the [Sapper](https://sapper.svelte.dev/docs#Pages) 
documentation. Here is an example from the [demo](./example):

```svelte
<script context="module">
    export function AllItemsVariables(page) {
        // if there is no filter assigned, dont enforce one in the query
        if (!page.params.filter || page.params.filter === 'all') {
            return {}
        }

        // make sure we recognize the value
        if (!['active', 'completed', 'all'].includes(page.params.filter)) {
            this.error(400, "filter must be one of 'active' or 'completed'")
            return
        }

        return {
            completed: page.params.filter === 'completed',
        }
    }
</script>
```

### What about `preload`?

Don't worry - that's where the preprocessor comes in. One of its responsibilities is moving the actual 
fetch into a `preload`. You can think of the block at the top of this section as equivalent to:

```svelte
<script context="module">
    export async function preload() {
            return {
                _data: await this.fetch({
                    text: `
                        query AllItems {
                            items {
                                id
                                text
                            }
                        }
                    ` 
                }),
            }
	}
</script>

<script>
    export let _data

    const data = readable(_data, ...)
</script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
```

## 🧩&nbsp;&nbsp;Fragments

Your components will want to make assumptions about which attributes are 
available in your queries. To address this, Houdini uses GraphQL fragments embedded 
inside if your component. Take, for example, a `UserAvatar` component:

```svelte
// components/UserAvatar.svelte

<script lang="ts">
    import { fragment, graphql } from 'houdini'
    import { UserAvatar } from '$generated'
    
    // the reference we will get passed from our parent as a prop
    export let user: UserAvatar
    
    const data = fragment(graphql`
    	fragment UserAvatar on User { 
	    profilePicture
	}
    `, user)
</script>

<img src={$data.profilePicture} />
```

This component can be rendered anywhere we can query for a user with a guaruntee
that the necessary data has been asked for:

```svelte
// src/routes/users.svelte

<script>
    import { query, graphql } from 'houdini'
    import { UserAvatar } from 'components/UserAvatar'

    const data = query(graphql`
        query AllUsers { 
            users { 
	        id
	        ...UserAvatar
	    }
        }
    `)
</script>

{#each $data.users as user}
    <UserAvatar user={user} />
{/each}
```

## 📝&nbsp;&nbsp;Mutations 

### Updating a record's field

### Connections

## ⚠️&nbsp;&nbsp;Notes, Constraints, and Conventions
- The compiler must be ran every time the contents of a `graphql` tagged string changes
- Every GraphQL Document must have a name that is unique
- Variable functions must be named after their query
- Documents with a query must have only one operation in them
- Documents without an operation must have only one fragment in them
