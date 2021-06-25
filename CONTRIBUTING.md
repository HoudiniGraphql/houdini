# Contributing to Houdini

🎉🎉 First off, thanks for the interest in contributing to Houdini! 🎉🎉

This document should hopefully provide some guidance for working on the project including
some tips for local development as well as an introduction to the internal architecture
and the relevant files/directories.

**Note**: this document contains links to files and sometimes specific lines of code which could easily be invalidated
with future work. If you run into a link that's broken or doesn't look right, please open a PR that fixes it.
Keeping documentation up to date is as important as _any_ bug fix or new feature.

## Table of Contents

1. [Local Development](#local-development)
1. [General Introduction](#general-introduction)
1. [The `generate` Command](#the-generate-command)
    1. [Internal GraphQL Schema](#internal-graphql-schema)
    1. [Document Artifacts](#document-artifacts)
1. [The Preprocessor](#the-preprocessor)
1. [The Runtime](#the-runtime)
1. [The Cache](#the-cache)
1. [Piecing It All Together](#piecing-it-all-together)
    1. [An Example: List Operations](#an-example-list-operations)

## Local Development

The quickest way to test and develop new features is by using the [example project](./example).
Starting with `yarn && yarn build` at the root of the repository will handle the details
of linking everything up. Once yarn is done, run `yarn generate && yarn dev` inside of the example
directory to start the development server. You will also need to start the example app's api with
`yarn api` (in a separate terminal, also inside the example directory). After all of this, you
should be able to visit `localhost:3000` in a web browser and see a working todo list.

## General Introduction

At a high level, houdini is broken up into two parts: a [command-line tool](./packages/houdini/cmd)
and a [preprocessor](./packages/houdini-preprocess). The command-line tool is responsible for a
variety of tasks including scaffolding a new project, validating a project's documents, and
generating the associated artifacts that the runtime needs to do its job. The preprocessor
handles optimizing the user's code for their specific platform and "connects the dots"
between what the user types and the houdini runtime.

## The `generate` Command

The `generate` command is the core of the command-line tool and is ultimately responsible for generating
the artifacts that describe every document in a project (identified as strings tagged with `graphql`).
These artifacts not only save the runtime from parsing the user's documents but also enable core features
such as compiling fragments and queries into a single string that can be sent to the API. The `generate`
command is defined in [packages/houdini/cmd/generate.ts](./packages/houdini/cmd/generate.ts) and is implemented as a
[pipeline](./packages/houdini/cmd/generate.ts#L34) of tasks that operate on the strings found in a project.
These tasks fall into three categories:

-   **Validators** are defined in [packages/houdini/cmd/validators](./packages/houdini/cmd/validators) and ensure that
    assumptions made by the rest of the tasks are true. For example, the
    [uniqueNames validator](./packages/houdini/cmd/validators/uniqueNames.ts) makes sure that every document
    has a unique name so that the preprocessor can reliably import the correct artifact.
-   **Transforms** are defined in [packages/houdini/cmd/transforms](./packages/houdini/cmd/transforms) and
    change the actual documents that the user provides. For example, the
    [composeQueries transform](./packages/houdini/cmd/transforms/composeQueries.ts) is responsible for adding
    any fragments that a query uses so they can be included in the network request sent to the server.
-   **Generators** are defined in [packages/houdini/cmd/generators](./packages/houdini/cmd/generators)
    and write things to disk. For example, the [typescript generator](./packages/houdini/cmd/generators/typescript.ts)
    creates type definitions for every document in a project.

### Internal GraphQL Schema

There are a number of features which rely on things that aren't defined in the project's schema.
Most these additions are added in the [schema transform](./packages/houdini/cmd/transforms/schema.ts) and are eventually
removed from the document to prevent the server from encountering anything unknown. The fragments used for
connection mutations are currently generated in a [separate transform](./packages/houdini/cmd/transforms/connections.ts).
Since the operation fragments are passed along to the server as part of the
[composeQueries transform](./packages/houdini/cmd/transforms/composeQueries.ts) they don't need to be removed
and are used to make sure the server returns the data needed for the operation. Whether they are removed from
the final query or not, the [artifact generator](./packages/houdini/cmd/generators/artifact/index.ts) looks for these
internal schema elements to encode additional information in the document's artifact that tells the runtime how to
handle the response from the server.

### Document Artifacts

The logic for constructing the document artifacts is done by generating a javascript abstract syntax tree and printing
it before writing the result to disk. This is done using the awesome [recast](https://github.com/benjamn/recast) library
but can still be tricky to get right. The [Online AST Explorer](https://astexplorer.net/) is incredibly useful for figuring out
the right objects to leave behind that will result in the desired code.

It's sometimes helpful to look at the shape of the artifacts that the `generate` command produces. Rather than
outlining every field contained in an artifact (which would likely go stale quickly) I recommend looking at the
[artifact snapshot tests](packages/houdini/cmd/generators/artifacts/artifacts.test.ts) to see what is generated in various
situations. At high level, the `raw` field is used when sending actual queries to the server and the `selection`
field is structured to save the runtime from wasting cycles (and bundle size) on parsing and "understanding" what the
user wants when they use a specific document. For more information about how these are used, see the [cache section](#the-cache).

## The Preprocessor

The preprocessor is defined in [packages/houdini-preprocess/src/index.ts](./packages/houdini-preprocess/src/index.ts)
as a pipeline that looks at every string tagged with `graphql` and mutates it into something the runtime can use.
For most situations this means adding an import to file for the relevant artifact and passing it to the
runtime (queries are a big exception). For a more detailed look into what actually happens with each document type,
you should look at the [snapshot tests](./packages/houdini-preprocess/src/transforms) for the corresponding function.

## The Runtime

The actual runtime used by houdini is defined in [packages/houdini/runtime](./packages/houdini/runtime) and is comprised of the
functions used in the user's components (ie, `query`, `fragment`, `mutation`, etc), a network layer that handles the actual requests
sent to the server, and a caching layer used to orchestrate data across the application.

### The Cache

As with most of this guide, the most reliable place to get an understanding for how
the cache's internals are organized is the [test suite](./packages/houdini/runtime/cache/cache.test.ts).
However, here is a brief explanation of the overall architecture so you can orient yourself:

Houdini's cache is built on top of two core interactions: writing data and
subscribing to a given selection. In order for a value to be written to the cache,
it must be given the the data along with schema information for the payload.
In response, the cache walks down the result and stores the value of every field that it
encounters in an object mapping the entity's id to the set of field values. This data is
stored in a normal form which means that references to other entities are not stored like scalar values
but are instead stored as references to other entries in the same map. This gives us a single
place where updates can be applied, without worrying about where that information is used. While walking
down the provided selection, the cache looks for information embedded by the artifact generator to perform
additional tasks like updating a connection.

While writing data is an important part of the interaction with the cache, the real "meat" is in the
subscription architecture which keeps the store returned by `query` (or `fragment`) up to date as values are changed.
Just like when writing data, the cache must be given an object that describes the full selection of data that
the store would like, however it also needs a function to call when the data has changed. In practice,
this function is just the `set` corresponding to the writable store powering a given `query` or `fragment`.
With these two things, the cache walks down the provided selection and embeds a reference to the `set`
function alongside the field values for a given object. When data is written to the cache, houdini looks
at the values being updated, captures every `set` function that must be called, and invokes the function with
an object matching the entire corresponding selection.

For a general introduction to normalized caching for GraphQL queries, check out the
[urql page on Normalized Caching](https://formidable.com/open-source/urql/docs/graphcache/normalized-caching/)
which gives a very good overview of the task, even if some of the actual implementation details differ from houdini's.

## Piecing It All Together

If you made it this far in the guide, you're awesome - even if you just skipped ahead. Either way, when it's
time to start thinking about adding a feature to the codebase, you should start by asking yourself a few questions:

1. Does the feature appear in the graphql documents that a developer will use? If so, you will need to think of a way
   to persist what the user types in the generated artifacts. Remember that the runtime will walk down the selection field
   when writing values to the cache and can look for special keys in order to perform arbitrary logic when dealing
   with a server's response. Once you have the information persisted in the artifact, all that's left is figuring out
   how the runtime will handle what's there.
1. Are there are any validation steps? They don't just have to protect the user but can also provide guarantees for
   the runtime that save you having to check a bunch of stuff when processing a server's response.
1. Can svelte provide any kind of help to the runtime? One of the benefits of generating the entire runtime is that the
   final code looks like any other code in a user's project. This means things like reactive statements and life-cycle functions
   work out of the box.
1. Can the feature be implemented as a layer over what the cache already supports? Caching in general is a famously tricky problem
   so it would be nice to avoid adding a lot of complexity if we can. It's useful to think of the cache as a "live"
   source of truth - if you can build your feature on top of the subscribe and write capabilities, it will likely be a lot
   easier to reason about.

Remember, an end-to-end feature for houdini will likely touch the artifact generator as well as the runtime (at the very least).
It's easy to get lost in how all of the pieces fit together. In order to help make things more clear, the implementation for list
operations will be outlined in the following section.

### An Example: List Operations

This section will contain links to exact lines of code in order to walk you through how the list operations are implemented and will
likely fall out of line with the actual codebase. If you encounter an incorrect link, **please** open a PR to fix it.

There are two parts to this feature. First, a user marks a particular field as a valid target for operations:

```graphql
query AllUsersQuery {
	users @connection(name: "All_Users") {
		id
		firstName
	}
}
```

... and then they use a a set of fragments in mutations that can mutate the list:

```graphql
mutation AddUserMutation {
	addUser(firstName: "Alec") {
		...All_Users_insert
	}
}
```

The steps for updating the `generate` function to support this feature can be broken down into the following:

1. Add the `connection` directive to the projects schema. As mentioned earlier, this is done in the
   [schema transform](./packages/houdini/cmd/transforms/schema.ts#L29).
1. Define the operation fragment somewhere that the [composeQueries transform](./packages/houdini/cmd/transforms/composeQueries.ts)
   can pick it up to include in the mutation query when its sent to the server. This happens in the
   [connection transform](./packages/houdini/cmd/transforms/connections.ts).
1. When generating the artifacts for the query,
   [remove any references to the `@connection` directive](./packages/houdini/cmd/generators/artifacts/index.ts#L107-L110) and
   [leave behind a label](./packages/houdini/cmd/generators/artifacts/selection.ts#L329-L331) identifying the field as
   the "All_Users" connection. For a better idea of how this label is embedded in the artifact, look at the
   [connection filters test](./packages/houdini/cmd/generators/artifacts/artifacts.test.ts#L1993).
1. When generating the artifact for the mutation, look for
   [any fragment spreads that are list operations](./packages/houdini/cmd/generators/artifacts/operations.ts#L27) and
   and [embed the set of operations](./packages/houdini/cmd/generators/artifacts/selection.ts#L335-L342) in the selection
   object for the mutation. For a better picture for how this looks in the final artifact, look at the
   [insert operation test](./packages/houdini/cmd/generators/artifacts/artifacts.test.ts#L537-L541).

With the information embedded in the artifacts, all that's left is to teach the runtime how to handle the server's response which
is broken down into two parts:

1. When the cache encounters a request to [subscribe to a field marked as a connection](./packages/houdini/runtime/cache/cache.ts#L192),
   it [saves a handler to that connection](./packages/houdini/runtime/cache/cache.ts#L199-L219) in an internal Map under the provided name.
1. When writing data, if the cache [encounters a field with a list of operations](./packages/houdini/runtime/cache/cache.ts#L457)
   embedded in the selection object, it [inserts the result](./packages/houdini/runtime/cache/cache.ts#L482-L484) in the connection
   using the handler it stored in step one.
