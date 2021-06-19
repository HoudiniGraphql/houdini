# Contributing to Houdini

🎉🎉 First off, thanks for the interest in contributing to Houdini! 🎉🎉

This document should hopefully provide some guidance for working on the project including
some tips for local development as well as a general introduction to the internal architecture
and the relevant files/directories.

## General Introduction

At a high level, houdini is broken up into two parts: a [command-line tool](./packages/houdini/cmd)
and a [preprocessor](./packages/houdini-preprocess). The command-line tool is responsible for a
variety of tasks including scaffolding a new project, validating a project's documents, and
generating the associated artifacts that the runtime needs to do its job. The preprocessor
handles optimizing the user's code for their specific platform and "connects the dots"
between what the user types and the houdini runtime.

### Local Development

<!--
    this section doesn't "flow" well from the section above. should it come before the
    description of the high level divide?
-->

The quickest way to test and develop new features is by using the [example project](./example).
Starting with `yarn && yarn build` at the root of the repository will handle the details
of linking everything up. Once yarn is done, run `yarn generate && yarn dev` inside of the example
directory to start the development server. You will also need to start the example app's api with
`yarn api` (in a separate terminal, also inside the example directory). After all of this, you
should be able to visit `localhost:3000` in a web browser and see a working todo list.

## The `generate` Command

The `generate` command is the core of the command-line tool and is ultimately responsible for generating
the artifacts that describe each document in a project. It's defined in the
[generate.ts](./packages/houdini/cmd/generate.ts) file and is implemented as a
[pipeline](./packages/houdini/cmd/generate.ts#L34-L44) of tasks that break down into three categories:

-   **Validators** are defined in [this directory](./packages/houdini/cmd/validators) and ensure that
    assumptions made by the rest of the tasks are true. For example, the
    [uniqueNames validator](./packages/houdini/cmd/validators/uniqueNames.ts) makes sure that every document
    has a unique name so that the preprocessor can reliably import the correct artifact.
-   **Transforms** are defined [here](./packages/houdini/cmd/transforms) and
    change the actual documents that the user provides. For example, the
    [composeQueries transform](./packages/houdini/cmd/transforms/composeQueries.ts) is responsible for adding
    any fragments that a query uses so they can be included in the network request sent to the server.
-   **Generators** are defined [here](./packages/houdini/cmd/generators) and write things to disk. For example, the
    [typescript generator](./packages/houdini/cmd/generators/typescript.ts) creates type definitions for every
    document in a project.

### Internal GraphQL schema

There are a number of features of houdini which rely on bits that aren't defined in the project's schema. For example,
the connection mutation API takes advantage of fragments that are defined by looking at which fields are tagged with
the `@connection` directive (which is also part of houdini's internal schema). These extra bits are added to the
project schema in the [schema transform](./packages/houdini/cmd/transforms/schema.ts) and are
[removed from the document](./packages/houdini/cmd/generators/artifacts/index.ts#108-110) before generating the artifacts.
Note that the connection fragments are currently defined in a [separate transform](./packages/houdini/cmd/transforms/connections.ts)
that looks at every document in a project and adds the required fragments to the pile.

### Connection Operations

## The Preprocessor

## The Runtime
