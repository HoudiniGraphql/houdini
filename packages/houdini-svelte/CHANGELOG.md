# houdini-svelte

## 0.17.12

### 🐛 Fixes

-   [#715](https://github.com/HoudiniGraphql/houdini/pull/715) [`493606a`](https://github.com/HoudiniGraphql/houdini/commit/493606aa06b00e7a588a556830c835ac94d1fb64) Thanks [@sjcobb2022](https://github.com/sjcobb2022)! - Fix onError and beforeLoad types

## 0.17.11

### 🐛 Fixes

-   [#708](https://github.com/HoudiniGraphql/houdini/pull/708) [`197bff7`](https://github.com/HoudiniGraphql/houdini/commit/197bff7d94c2600187b5ab76ed3168957b4a8f31) Thanks [@jycouet](https://github.com/jycouet)! - import VariableFunction type when a function type is defined

## 0.17.10

### 🐛 Fixes

-   [#702](https://github.com/HoudiniGraphql/houdini/pull/702) [`83d9340`](https://github.com/HoudiniGraphql/houdini/commit/83d934072641acad3a959e49a14f29d838c960bf) Thanks [@sjcobb2022](https://github.com/sjcobb2022)! - FIX: type imports not generated correctly for non-fetching endpoints

-   [#703](https://github.com/HoudiniGraphql/houdini/pull/703) [`cb29530`](https://github.com/HoudiniGraphql/houdini/commit/cb295302f05e6a897eadf2ca95595d8c9c62e6ef) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Remove unused functions in runtime

## 0.17.9

-   Updated dependencies [[`6e36775`](https://github.com/HoudiniGraphql/houdini/commit/6e367755d902eca3242519b4c609c0d5bc76f4ff)]:
    -   houdini@0.17.9

## 0.17.8

### 🐛 Fixes

-   [#691](https://github.com/HoudiniGraphql/houdini/pull/691) [`e707fbe`](https://github.com/HoudiniGraphql/houdini/commit/e707fbec36c223ad549c31df6bfa68ae312ffa9a) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Added artifact import to subscription stores

-   Updated dependencies []:
    -   houdini@0.17.8

## 0.17.7

### 🐛 Fixes

-   [#689](https://github.com/HoudiniGraphql/houdini/pull/689) [`db67e82`](https://github.com/HoudiniGraphql/houdini/commit/db67e822fcec2362538bda548d058fa7e3397ffa) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix duplicate import for generated subscription stores

## 0.17.6

### 🐛 Fixes

-   [#686](https://github.com/HoudiniGraphql/houdini/pull/686) [`f138bff`](https://github.com/HoudiniGraphql/houdini/commit/f138bff8854181da63b545f54462b198794e2bbc) Thanks [@jycouet](https://github.com/jycouet)! - isFetching will switch only when a network call is happening (and starts at true for queries)

### ✨ Features

-   [#676](https://github.com/HoudiniGraphql/houdini/pull/676) [`b7a07a3`](https://github.com/HoudiniGraphql/houdini/commit/b7a07a37ec1fd2fe7b9e6ca34e9e2beb53b84bce) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add config for users to specify custom stores

-   [#673](https://github.com/HoudiniGraphql/houdini/pull/673) [`3986d5e`](https://github.com/HoudiniGraphql/houdini/commit/3986d5e5491565a19fabc440972ef4d95d548e92) Thanks [@sjcobb2022](https://github.com/sjcobb2022)! - Improve generated types for routes

## 0.17.5

### 🐛 Fixes

-   [#659](https://github.com/HoudiniGraphql/houdini/pull/659) [`579fb0b`](https://github.com/HoudiniGraphql/houdini/commit/579fb0bd4ccc5ee6e9aad0cc6278b0a9bfa972d1) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Improve typing for loadAll

## 0.17.3

### 🐛 Fixes

-   [#643](https://github.com/HoudiniGraphql/houdini/pull/643) [`35b189f`](https://github.com/HoudiniGraphql/houdini/commit/35b189f8cc494ce4f80d54c00736e9dd8d3c69e7) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix error preventing session in certain node versions

## 0.17.2

### 🐛 Fixes

-   [#639](https://github.com/HoudiniGraphql/houdini/pull/639) [`cfdb009`](https://github.com/HoudiniGraphql/houdini/commit/cfdb00907829576b142366bad8835e2d32f3ea78) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix error with generated route types

-   [#633](https://github.com/HoudiniGraphql/houdini/pull/633) [`8e52a90`](https://github.com/HoudiniGraphql/houdini/commit/8e52a907642003c3b9c9f9b2a4c9824e49136b5d) Thanks [@jycouet](https://github.com/jycouet)! - fix: queries will be sent once if they are defined in +(page|layout).gql

## 0.17.1

### 🐛 Fixes

-   [#630](https://github.com/HoudiniGraphql/houdini/pull/630) [`02d8fc4`](https://github.com/HoudiniGraphql/houdini/commit/02d8fc47f71980bd2b6492162b8e57808447bdbc) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix relative imports from root layout

## 0.17.0

### ⚠️ Breaking Changes

-   [#593](https://github.com/HoudiniGraphql/houdini/pull/593) [`c1363fe`](https://github.com/HoudiniGraphql/houdini/commit/c1363fe938ab94281272cad8939b892fd705a803) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Split houdini into two packages: `houdini` and `houdini-svelte`

### ✨ Features

-   [#593](https://github.com/HoudiniGraphql/houdini/pull/593) [`c1363fe`](https://github.com/HoudiniGraphql/houdini/commit/c1363fe938ab94281272cad8939b892fd705a803) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Adding layout.gql special file

-   [#610](https://github.com/HoudiniGraphql/houdini/pull/610) [`3168f7d`](https://github.com/HoudiniGraphql/houdini/commit/3168f7dffd06f5074d08652d2d2c459377bc73d6) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Generate variable function definitions for non-route queries

### 🐛 Fixes

-   [#613](https://github.com/HoudiniGraphql/houdini/pull/613) [`eb3ffe1`](https://github.com/HoudiniGraphql/houdini/commit/eb3ffe1fbf14180210464863cb7e2ca29892a1fe) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Avoid unnecessary data prop being added to route
