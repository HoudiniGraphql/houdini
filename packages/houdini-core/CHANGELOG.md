# houdini-core

## 2.0.1

### Patch Changes

- [#1704](https://github.com/HoudiniGraphql/houdini/pull/1704) [`56a57d2`](https://github.com/HoudiniGraphql/houdini/commit/56a57d26837190503e5380ee1c3cd84c17cf613c) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Improved ergonomics for `@loading`.

## 2.0.0

### Major Changes

- [#1599](https://github.com/HoudiniGraphql/houdini/pull/1599) [`d447227`](https://github.com/HoudiniGraphql/houdini/commit/d44722725c5e2302e041e3360020e386e098730f) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Bump Vite version

- [#1593](https://github.com/HoudiniGraphql/houdini/pull/1593) [`8bd407b`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Rewrote entire codegen pipeline in golang

### Minor Changes

- [`ef91e5c`](https://github.com/HoudiniGraphql/houdini/commit/ef91e5c1d00526fea772d3eae5661a8617fd79ce) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add scalar module imports

- [`15c9453`](https://github.com/HoudiniGraphql/houdini/commit/15c945382821d5c4f7ddc94892a86d922fcf2c76) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add the `@plural` fragment directive for spreading a fragment on a list field.

- [#1687](https://github.com/HoudiniGraphql/houdini/pull/1687) [`f1ae542`](https://github.com/HoudiniGraphql/houdini/commit/f1ae542be6e094b4e39b1b181176c00d4eac1956) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add the `@refetch` directive to mark a record in a mutation or subscription response so the cache refetches every document that depends on it once the response is written.

- [`15c9453`](https://github.com/HoudiniGraphql/houdini/commit/15c945382821d5c4f7ddc94892a86d922fcf2c76) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add the `@refetchable` directive to mark a fragment as refetchable on its own with new argument values.

- [#1646](https://github.com/HoudiniGraphql/houdini/pull/1646) [`bf966b9`](https://github.com/HoudiniGraphql/houdini/commit/bf966b9eaf35166628bb6b3ed0f35b8a42700b6c) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add `record.refresh()` to refetch every document that contains a given cache record, including those that reference it only through a fragment spread.

### Patch Changes

- [#1644](https://github.com/HoudiniGraphql/houdini/pull/1644) [`f40e510`](https://github.com/HoudiniGraphql/houdini/commit/f40e510e0e67cd4ecc444f01662e3163fe45e736) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add support for @includeListID directive
