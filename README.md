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

## 📚&nbsp;&nbsp;Table of Contents

1. [Example](#example)
1. [Installation](#installation)
1. [Configuring Your Environment](#configuring-your-environment)
1. [Running the Compiler](#running-the-compiler)
1. [Fetching Data](#fetching-data)
    1. [Query variables and page data](#query-variables-and-page-data)
    1. [What about preload?](#what-about-preload)
1. [Fragments](#fragments)
1. [Mutations](#mutations)
    1. [Updating fields](#updating-fields)
    1. [Connections](#connections)
        1. [Insert](#inserting-a-record)
        1. [Remove](#removing-a-record)
        1. [Delete](#deleting-a-record)
        1. [Conditionals](#conditionals)
1. [Typescript](#typescript)
1. [Notes, Constraints, and Conventions](#%EF%B8%8Fnotes-constraints-and-conventions)

## 🕹️&nbsp;&nbsp;Example

A demo can be found in the <a href='./example'>example directory</a>.

## ⚡&nbsp;&nbsp;Installation

houdini is available on npm:

```sh
yarn add -D houdini houdini-preprocess houdini-compiler
# or
npm install --save-dev houdini houdini-preprocess houdini-compiler
```

## 🔧&nbsp;&nbsp;Configuring Your Environment

Setting up a new houdini project can easily be done with the provided command-line tool:

```sh
npx houdini-compiler init
```

This will create a few necessary files as well as pull down a json representation of
your API's schema. Up next, add the preprocessor to your sapper/sveltekit setup. Don't
forget to add it to both the client and the server configurations!

```typescript
import houdini from 'houdini-preprocess'

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

## 🦾&nbsp;&nbsp;Running the Compiler

Running the compiler can be done with npx or via a script in `package.json`. This command needs to be 
run anytime a GraphQL document in your source code changes:

```sh
npx houdini-compiler generate
```

## 🚀&nbsp;&nbsp;Fetching Data

Grabbing data from your API is done with the `query` function:

```svelte
<script lang="ts">
    import { query, graphql } from 'houdini'

    // load the items
    const data = query(graphql`
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
that are given to the `preload` function described in the [Sapper](https://sapper.svelte.dev/docs#Pages)
documentation. Here is a modified example from the [demo](./example):

```svelte
// src/routes/[filter].svelte

<script lang="ts">
    import { query, graphql } from 'houdini'

    // load the items
    const data = query(graphql`
        query AllItems($completed: Boolean) {
            items(completed: $completed) {
                id
                text
            }
        }
    `)
</script>

<script context="module">
    // This is the function for the AllItems query.
    // Query variable functions must be named <QueryName>Variables.
    export function AllItemsVariables(page) {
        // make sure we recognize the value
        if (!['active', 'completed'].includes(page.params.filter)) {
            this.error(400, "filter must be one of 'active' or 'completed'")
            return
        }

        return {
            completed: page.params.filter === 'completed',
        }
    }
</script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
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
available in your queries. To support this, Houdini uses GraphQL fragments embedded
inside of your component. Take, for example, a `UserAvatar` component that requires
the `profilePicture` field of a `User`:

```svelte
// components/UserAvatar.svelte

<script lang="ts">
    import { fragment, graphql } from 'houdini'

    // the reference we will get passed as a prop
    export let user

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

It's worth mentioning explicitly that a component can rely on multiple fragments
at the same time so long as the fragment names are unique and prop names are different.

## 📝&nbsp;&nbsp;Mutations

Mutations are defined in your component like the rest of the documents but
instead of triggering a network request when called, a function is returned
which can be invoked to execute the mutation. Here's another modified example from
[the demo](./example):

```svelte
<script>
    import { mutation, graphql } from 'houdini'

    let itemID

    const uncheckItem = mutation(graphql`
        mutation UncheckItem($id: ID!) {
            uncheckItem(item: $id) {
                item {
                    id
                    completed
                }
            }
        }
    `)
</script>

<button on:click={() => uncheckItem({ id: itemID })}>
    Uncheck Item
</button>
```

Note: mutations usually do best when combined with at least one fragment grabbing
the information needed for the mutation (for an example of this pattern, see the TodoItem
component in the demo.)

### Updating a record's field

When a mutation is responsible for updating a small number of fields on a single entity, houdini
should take care of the details for you as long as you request the updated data alongside the
record's id. Take for example, a `TodoItem` component:

```svelte
<script lang="ts">
    import { fragment, mutation, graphql } from 'houdini'

    export let item

    // the resulting store will stay up to date whenever `checkItem`
    // is triggered
    const data = fragment(
        graphql`
            fragment ItemEntry_item on TodoItem {
                id
                text
                completed
            }
        `,
        item
    )

    const checkItem = mutation(graphql`
        mutation CompleteItem($id: ID!) {
            checkItem(item: $id) {
                item {
                    id
                    completed
                }
            }
        }
    `)
</script>

<li class:completed={$data.completed}>
    <input
        name={$data.text}
        class="toggle"
        type="checkbox"
        checked={$data.completed}
        on:click={handleClick}
    />
    <label for={$data.text}>{$data.text}</label>
    <button class="destroy" on:click={() => deleteItem({ id: $data.id })} />
</li>
```

### Connections

Adding and removing records from a list is done by mixing together a few different generated fragments
and directives. In order to tell the compiler which lists are targets for these operations, you have to
mark them with the `@connection` directive and provide a unique name:

```graphql
query AllItems {
    items @connection(name: "All_Items") {
        id
    }
}
```

It's recommended to name these connections with an different casing convention than the rest of your
application to distinguish the generated fragments from those in your codebase.

#### Inserting a record

With this field tagged, any mutation that returns an `Item` can be used to insert items in this list:

```graphql
mutation NewItem($input: AddItemInput!) {
    addItem(input: $input) {
        ...All_Items_insert
    }
}
```

#### Removing a record

Any mutation that returns an `Item` can also be used to remove an item from the connection:

```graphql
mutation RemoveItem($input: RemoveItemInput!) {
    removeItem(input: $input) {
        ...All_Items_remove
    }
}
```

#### Deleting a record

Sometimes it can be tedious to remove an record from every single connection it is found in.
For these situations, Houdini provides a directive that can be used to mark a field in
the mutation response holding the ID of a record to delete from all connections.

```graphql
mutation DeleteItem($id: ID!) {
    deleteItem(id: $id) {
        itemID @Item_delete
    }
}
```

#### Conditionals

Sometimes you only want to add or remove a record from a connection when an argument has a particular value.
For example, in a todo list you might only want to add the result to the list if there is no filter being
applied. To support this, houdini provides the `@when` and `@when_not` directives:

```graphql
mutation NewItem($input: AddItemInput!) {
    addItem(input: $input) {
        ...All_Items_insert @when_not(argument: "completed", value: "true")
    }
}
```

## Typescript



## ⚠️&nbsp;&nbsp;Notes, Constraints, and Conventions
- The compiler must be ran every time the contents of a `graphql` tagged string changes
- Every GraphQL Document must have a name that is unique
- Variable functions must be named after their query
- Documents with a query must have only one operation in them
- Documents without an operation must have only one fragment in them
