<div align="center">
  <img alt="houdini" height="200" src=".github/assets/houdini-v5.png" />

  <br />
  <br />

  <strong>
    The disappearing GraphQL client for Sapper and SvelteKit.
  </strong>
  <br />
  <br />
</div>


```svelte
<script>
    import { query, graphql } from '$houdini'

    const { data } = query(graphql`
        query AllTodoItems {
            items {
                text
            }
        }
    `)
</script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
```

## ✨&nbsp;&nbsp;Features

-   Composable and colocated data requirements for your components
-   Normalized cache with declarative updates
-   Generated types
-   Subscriptions
-   Support for SvelteKit and Sapper
-   Pagination (cursors **and** offsets)

At its core, houdini seeks to enable a high quality developer experience
without compromising bundle size. Like Svelte, houdini shifts what is
traditionally handled by a bloated runtime into a compile step that allows
for the generation of an incredibly lean GraphQL abstraction for your application.

## 🕹&nbsp;&nbsp;Example

For a detailed example, you can check out the todo list in the [example directory](./example) or the [final version](https://github.com/HoudiniGraphql/intro/tree/final) of the 
Pokédex application from the [Getting Started guide](https://www.houdinigraphql.com/intro/welcome). 

## 📚&nbsp;&nbsp;Documentation

For documentation, please visit the [api reference](https://www.houdinigraphql.com/api/welcome) on the website.

## 🚀&nbsp;&nbsp;Getting Started

For an in-depth guide to getting started with Houdini, check out the [guide on the our website](https://www.houdinigraphql.com/intro/welcome).

## ✏️&nbsp;&nbsp;Contributing

If you are interested in helping out, the [contributing guide](https://www.houdinigraphql.com/guides/contributing) should provide some guidance. If you need something more
specific, feel free to reach out to @AlecAivazis on the Svelte discord. There's lots to help with regardless of how deep you want to dive or how much time you can spend 🙂
