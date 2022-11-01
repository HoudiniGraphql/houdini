# houdini-svelte

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
