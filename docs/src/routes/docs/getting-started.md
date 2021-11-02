---
title: Getting Started
description: How to install and get started with Houdini
---

# Installation

houdini is available on npm.

```sh
yarn add -D houdini houdini-preprocess
# or
npm install --save-dev houdini houdini-preprocess
```

# Configuring Your Application

Adding houdini to an existing project can easily be done with the provided command-line tool. If you don't already have an existing app, visit [this link](https://kit.svelte.dev/docs) for help setting one up. Once you have a project and want to add houdini, execute the following command which will create a few necessary files, as well as pull down a json representation of your API's schema.

```sh
npx houdini init
```

This will send a request to your API to download your schema definition. If you need
headers to authenticate this request, you can pass them in with the `--pull-header`
flag (abbreviated `-ph`). For example,
`npx houdini init -ph Authorization="Bearer MyToken"`.
You will also need to provide the same flag to `generate` when using the
`--pull-schema` flag.
Finally, follow the steps appropriate for your framework.

## SvelteKit

We need to define an alias so that your codebase can import the generated runtime. Add the following values to `svelte.config.js`:

```typescript
import houdini from 'houdini-preprocess'

{
    preprocess: [houdini()],

    kit: {
        vite: {
            resolve: {
                alias: {
                    $houdini: path.resolve('.', '$houdini')
                }
            }
        }
    }
}
```

And finally, we need to configure our application to use the generated network layer. To do this, add the following block of code to `src/routes/__layout.svelte`:

```typescript
<script context="module">
	import env from '../environment'; import {setEnvironment} from '$houdini'; setEnvironment(env);
</script>
```

You might need to generate your runtime in order to fix typescript errors.

**Note**: If you are building your application with
[`adapter-static`](https://github.com/sveltejs/kit/tree/master/packages/adapter-static) (or any other adapter that turns
your application into a static site), you will need to set the `static` value in your config file to `true`.

### Sapper

You'll need to add the preprocessor to both your client and your server configuration:

```typescript
import houdini from 'houdini-preprocess'

// add to both server and client configurations
{
	plugins: [
		svelte({
			preprocess: [houdini()],
		}),
	]
}
```

With that in place, the only thing left to configure your Sapper application is to connect your client and server to the generate network layer:

```typescript
// in both src/client.js and src/server.js

import { setEnvironment } from '$houdini'
import env from './environment'

setEnvironment(env)
```

### Svelte

If you are working on an application that isn't using SvelteKit or Sapper, you have to configure the
compiler and preprocessor to generate the correct logic by setting the `framework` field in your
config file to `"svelte"`.

Please keep in mind that returning the response from a query, you should not rely on `this.redirect` to handle the
redirect as it will update your browsers `location` attribute, causing a hard transition to that url. Instead, you should
use `this.error` to return an error and handle the redirect in a way that's appropriate for your application.

## Running the Compiler

The compiler is responsible for a number of things, ranging from generating the actual runtime
to creating types for your documents. Running the compiler can be done with npx or via a script
in `package.json` and needs to be run every time a GraphQL document in your source code changes:

```sh
npx houdini generate
```

The generated runtime can be accessed by importing `$houdini` anywhere in your application.

If you have updated your schema on the server, you can pull down the most recent schema before generating your runtime by using `--pull-schema` or `-p`:

```sh
npx houdini generate --pull-schema
```

## 📄&nbsp;Config File

All configuration for your houdini application is defined in a single file that is imported by both the runtime and the
command-line tool. Because of this, you must make sure that any imports and logic are resolvable in both environments.
This means that if you rely on `process.env` or other node-specifics you will have to use a
[plugin](https://www.npmjs.com/package/vite-plugin-replace) to replace the expression with something that can run in the browser.
