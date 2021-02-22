# 🎩 houdini

The disappearing GraphQL client built for the Svelte community.

## ✨ Features

- Composable and colocated data requirements for your components
- Document caching and declarative updates
- Sapper/Sveltekit ready
- Generated types 
- Customizable error handling (coming soon)

At it's core, Houdini seeks to enable a high quality developer experience
without compromising runtime bundle size. Like Svelte, Houdini shifts what is 
traditionally handled by a bloated runtime into a compile step that allows 
for the generation of an incredibly lean GraphQL abstraction for your application.

## ⚡ Example

A demo can be found in the <a href='./example'>example directory.</a>

## 🕹️ Installation

Houdini is available on npm:

```
yarn add houdini houdini-tools
# or
npm install --save houdini houdini-tools
```

## 🔧 Configuring Your Environment

Setting up a new houdini project can easily be done with the provided command-line tool:

```bash
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
      preprocess: houdini()
    })
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
