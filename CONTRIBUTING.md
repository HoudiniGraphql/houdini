# Contributing to Houdini

🎉🎉 First off, thanks for the interest in contributing to Houdini! 🎉🎉

This document should hopefully provide some guidance for working on the project including
some tips for local development as well as an introduction to the internal architecture
and the relevant files/directories.

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

It's sometimes helpful to look at the shape of the artifacts that the `generate` command produces. Rather than outlining
them in this document (which would likely go stale quickly) I recommend looking at the
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
