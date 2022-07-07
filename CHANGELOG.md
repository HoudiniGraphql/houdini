# houdini

## 0.15.5

### Patch Changes

-   [#377](https://github.com/HoudiniGraphql/houdini/pull/377) [`9836c94`](https://github.com/HoudiniGraphql/houdini/commit/9836c94f36a0cba387a86ef31075cf318a5df557) Thanks [@jycouet](https://github.com/jycouet)! - avoid manipulating scalars with null values

*   [#384](https://github.com/HoudiniGraphql/houdini/pull/384) [`0c567cd`](https://github.com/HoudiniGraphql/houdini/commit/0c567cd3c4c9eb44f63e54712582e15837472773) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix bug with incorrect page info type

## 0.15.4

### Patch Changes

-   [#378](https://github.com/HoudiniGraphql/houdini/pull/378) [`6e71762`](https://github.com/HoudiniGraphql/houdini/commit/6e717629e0059cead070a92db9a6b81c91a163d2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - always treat layout files as routes

## 0.15.3

### Patch Changes

-   [#375](https://github.com/HoudiniGraphql/houdini/pull/375) [`918ff87`](https://github.com/HoudiniGraphql/houdini/commit/918ff87b9a7f5ff1068327c36088df1c89df6341) Thanks [@jycouet](https://github.com/jycouet)! - fix issue with embedded page info in paginated query stores

## 0.15.2

### Patch Changes

-   [#370](https://github.com/HoudiniGraphql/houdini/pull/370) [`1ce03ec`](https://github.com/HoudiniGraphql/houdini/commit/1ce03ece112bf2688dcc066bdd844fa8b431fe4a) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fixed bug when generating type definitions for interfaces mixed on interfaces

## 0.15.1

### Patch Changes

-   [#366](https://github.com/HoudiniGraphql/houdini/pull/366) [`5a1e7e0`](https://github.com/HoudiniGraphql/houdini/commit/5a1e7e07e0e2cf8734dae3af1a95b93600328734) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - improved logic for distinguishing routes from components in a SvelteKit project

*   [#367](https://github.com/HoudiniGraphql/houdini/pull/367) [`66d0bcf`](https://github.com/HoudiniGraphql/houdini/commit/66d0bcfb1d0f70dae966540a8858aed285c15e0e) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add a `configFile` parameter to the preprocessor so users can specify where to find their `houdini.config.js` file

-   [#364](https://github.com/HoudiniGraphql/houdini/pull/364) [`b323f54`](https://github.com/HoudiniGraphql/houdini/commit/b323f5411db92f669edef64eed0df59bb0233ae8) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add enum definitions to generated runtime

## 0.15.0

Version 0.15.0 is the biggest release yet! Thanks for everyone who helped test/contribute :tada: 🥰 The biggest update here is that documents now have a brand new store-based API. For more information on what's changed and how to update your project, check out this link: https://www.houdinigraphql.com/guides/migrating-to-0.15.0

### Breaking Changes

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@AlecAivazis][@jycouet](https://github.com/jycouet)! - definitionsPath refers now to a folder path that will contain schema and documents

*   [#315](https://github.com/HoudiniGraphql/houdini/pull/315) [`4cf4b7f`](https://github.com/HoudiniGraphql/houdini/commit/4cf4b7f93d893ede734c7a067f03b14499cc9773) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - parentID directive and arguments are now relative to object containing the decorated field

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@jycouet](https://github.com/jycouet)! - Default framework is now kit, default module type is esm

*   [#291](https://github.com/HoudiniGraphql/houdini/pull/291) [`17cd57e`](https://github.com/HoudiniGraphql/houdini/commit/17cd57eac72596823d2a4dddec85b6ac1a1d09dd) Thanks [@jycouet](https://github.com/jycouet) and [@AlecAivazis](https://github.com/AlecAivazis)! - Added store-based APIs :tada:

### Fixes/Updates

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Missing scalars generate as any and produce a console warning instead of an error

-   [#331](https://github.com/HoudiniGraphql/houdini/pull/331) [`41cd95a`](https://github.com/HoudiniGraphql/houdini/commit/41cd95a577e418b6937039da963f82c95bd79854) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fixed return type of inline mutation

*   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add `disableMasking` config value to disable fragment masking

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - initial value for inline fragment can be null

*   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Added support for non-string cursors

-   [#341](https://github.com/HoudiniGraphql/houdini/pull/341) [`a0b6030`](https://github.com/HoudiniGraphql/houdini/commit/a0b6030324816765b6c5cf451dd09586fbd886ec) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - allow null values passed to fragment

*   [#321](https://github.com/HoudiniGraphql/houdini/pull/321) [`47bb94e`](https://github.com/HoudiniGraphql/houdini/commit/47bb94ea4b6c36210f1d2b7812613287fbe82e61) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - config.schemaPath can be a glob pointing to multiple files

## 0.14.8

### Patch Changes

-   [#310](https://github.com/HoudiniGraphql/houdini/pull/310) [`5cba9e2`](https://github.com/HoudiniGraphql/houdini/commit/5cba9e25a314fc6378e48a3114a91cc1fb8d7557) Thanks [@alexlafroscia](https://github.com/alexlafroscia)! - scrub variables only used by internal directives from query

## 0.14.7

### Patch Changes

-   [#306](https://github.com/HoudiniGraphql/houdini/pull/306) [`fe79ff3`](https://github.com/HoudiniGraphql/houdini/commit/fe79ff337aa922d19fdb6f36182fa365c85a2093) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fixed bug when loading data inserted with mutation

## 0.14.6

### Patch Changes

-   [#299](https://github.com/HoudiniGraphql/houdini/pull/299) [`83032d8`](https://github.com/HoudiniGraphql/houdini/commit/83032d8d671968688255cbe2c507e7252cfb747d) Thanks [@rmarscher](https://github.com/rmarscher)! - add support for typescript 4.5

## 0.14.5

### Patch Changes

-   [#295](https://github.com/HoudiniGraphql/houdini/pull/295) [`2c75823`](https://github.com/HoudiniGraphql/houdini/commit/2c758235a65f5c4bf1b619ea295e0655893a95b1) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Pass contents of page and session store to variable functions for component queries

*   [#296](https://github.com/HoudiniGraphql/houdini/pull/296) [`1cce6a6`](https://github.com/HoudiniGraphql/houdini/commit/1cce6a6e0d52a89b41c904b5714685fcbfa5db74) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Load data for component query when nothing was cached

## 0.14.4

### Patch Changes

-   [#292](https://github.com/HoudiniGraphql/houdini/pull/292) [`c6f5d60`](https://github.com/HoudiniGraphql/houdini/commit/c6f5d6011b533998dc76ebe9e2617eb05096e750) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Only generate after load types for queries

*   [#288](https://github.com/HoudiniGraphql/houdini/pull/288) [`4c09aba`](https://github.com/HoudiniGraphql/houdini/commit/4c09aba4926ec75515302269c8643e4ce783337c) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Update dependency `svelte`

-   [#292](https://github.com/HoudiniGraphql/houdini/pull/292) [`c6f5d60`](https://github.com/HoudiniGraphql/houdini/commit/c6f5d6011b533998dc76ebe9e2617eb05096e750) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Pass variables to `afterLoad` hook

## 0.14.3

### Patch Changes

-   [#283](https://github.com/HoudiniGraphql/houdini/pull/283) [`dd20142`](https://github.com/HoudiniGraphql/houdini/commit/dd201422f0359f44cf18b338ed4ecd0d13799149) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fixed bug in component queries associated with the unloaded response from `load`.

## 0.14.2

### Patch Changes

-   [#277](https://github.com/HoudiniGraphql/houdini/pull/277) [`d010c3f`](https://github.com/HoudiniGraphql/houdini/commit/d010c3f8b5b4005a6ca02e748724079134fcebbd) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - List operations no longer throw an exception if the list isn't found as well as a few improvements to the list caching strategy

*   [#279](https://github.com/HoudiniGraphql/houdini/pull/279) [`de1ae3b`](https://github.com/HoudiniGraphql/houdini/commit/de1ae3be60f04971c1b9c8bca9a89973438a1965) Thanks [@oplik0](https://github.com/oplik0)! - add pinst to disable postinstall for publishing

## 0.14.1

### Patch Changes

-   [#275](https://github.com/HoudiniGraphql/houdini/pull/275) [`baf233b`](https://github.com/HoudiniGraphql/houdini/commit/baf233b10f447006386ef0b2de1a3a53edecf6c0) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fixed edge cases involving adding, removing, and deleting records back to back from in-memory cache"

## 0.14.0

### Breaking Changes

-   [#273](https://github.com/HoudiniGraphql/houdini/pull/273) [`2adabd7`](https://github.com/HoudiniGraphql/houdini/commit/2adabd7c78b89f12cd556a241245899b13cde30f) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Consolidated all houdini packages under a single import. The preprocessor should now be imported from `houdini/preprocess`.

### Patch Changes

-   [#263](https://github.com/HoudiniGraphql/houdini/pull/263) [`c5cce52`](https://github.com/HoudiniGraphql/houdini/commit/c5cce5217149bc1b2be1f48cb734fb451b03a28f) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Added support for non-standard IDs and paginated fragment queries

## 0.13.10

### Patch Changes

-   [#269](https://github.com/HoudiniGraphql/houdini/pull/269) [`bfcd003`](https://github.com/HoudiniGraphql/houdini/commit/bfcd00357e92b47caec988baa919c5c84ddcc333) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Execute multiple queries in parallel

## 0.13.9

### Patch Changes

-   [#266](https://github.com/HoudiniGraphql/houdini/pull/266) [`b26cb5e`](https://github.com/HoudiniGraphql/houdini/commit/b26cb5e032ffb87c40b3c43cef73c211cf2fd3de) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Fix `afterLoad` data

## 0.13.8

### Patch Changes

-   [#259](https://github.com/HoudiniGraphql/houdini/pull/259) [`d49c30a`](https://github.com/HoudiniGraphql/houdini/commit/d49c30a844228a6004f4590fd74355691f17095e) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fixes an issue when resolving the first layer in the cache
