# houdini-core

## 2.0.0-next.28

### Patch Changes

- [#1682](https://github.com/HoudiniGraphql/houdini/pull/1682) [`54505e2`](https://github.com/HoudiniGraphql/houdini/commit/54505e2c594ff56d802e7fcf43522b84c1a861ba) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix nil panic when generating artifacts for fragments with nested @with directives, and make artifact generation deterministic by sorting keys consistently.

## 2.0.0-next.27

### Patch Changes

- [#1680](https://github.com/HoudiniGraphql/houdini/pull/1680) [`704f3b4`](https://github.com/HoudiniGraphql/houdini/commit/704f3b4ba8be98f5b136c3279133a99511bf0e62) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix nil panic with nested fragment argument values

## 2.0.0-next.26

### Patch Changes

- [#1678](https://github.com/HoudiniGraphql/houdini/pull/1678) [`e0e4166`](https://github.com/HoudiniGraphql/houdini/commit/e0e4166fe21f6090fce1fdcfc8023214fab320ac) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - More fixes for example fragment variables

## 2.0.0-next.25

### Patch Changes

- [#1675](https://github.com/HoudiniGraphql/houdini/pull/1675) [`aee18e4`](https://github.com/HoudiniGraphql/houdini/commit/aee18e413618c6bccbd70a420142e44e929d63c1) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix issue in fragment argument expansion

## 2.0.0-next.24

### Patch Changes

- [#1671](https://github.com/HoudiniGraphql/houdini/pull/1671) [`f064d16`](https://github.com/HoudiniGraphql/houdini/commit/f064d165dcd38888ddb65bed065bb0ab3685c691) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fixed enum literals inside object and list arguments being serialized as quoted strings in printed queries.

## 2.0.0-next.23

### Patch Changes

- [#1664](https://github.com/HoudiniGraphql/houdini/pull/1664) [`4ea90cb`](https://github.com/HoudiniGraphql/houdini/commit/4ea90cbc458899ecc5c262d7f80f2d013d7a0a1e) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fixed fragment pagination

## 2.0.0-next.22

### Minor Changes

- [#1646](https://github.com/HoudiniGraphql/houdini/pull/1646) [`bf966b9`](https://github.com/HoudiniGraphql/houdini/commit/bf966b9eaf35166628bb6b3ed0f35b8a42700b6c) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add `record.refresh()` to refetch every document that contains a given cache record, including those that reference it only through a fragment spread.

### Patch Changes

- [#1649](https://github.com/HoudiniGraphql/houdini/pull/1649) [`8bd7291`](https://github.com/HoudiniGraphql/houdini/commit/8bd72911a7a022ccb68e7c3b5047f144077c3e4c) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix list filters and @when conditions that contain object values or variable references nested inside objects

- [#1644](https://github.com/HoudiniGraphql/houdini/pull/1644) [`f40e510`](https://github.com/HoudiniGraphql/houdini/commit/f40e510e0e67cd4ecc444f01662e3163fe45e736) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add support for @includeListID directive

- [#1648](https://github.com/HoudiniGraphql/houdini/pull/1648) [`5f3fd63`](https://github.com/HoudiniGraphql/houdini/commit/5f3fd635199681ef36ecb90a16df2e109a354c22) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Rework argument type validation to follow the GraphQL spec, fixing coercions, `@with` checks, and unknown type/enum reporting ([#1645](https://github.com/HoudiniGraphql/houdini/issues/1645)).

## 2.0.0-next.21

### Patch Changes

- [`fec6727`](https://github.com/HoudiniGraphql/houdini/commit/fec672700d142c0e300da0529f7404b3e8521a09) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - strip sibling fields from generated pagination query documents so only the paginated field is included

## 2.0.0-next.20

### Patch Changes

- [#1639](https://github.com/HoudiniGraphql/houdini/pull/1639) [`b3798cd`](https://github.com/HoudiniGraphql/houdini/commit/b3798cde406da0f4160ee64e6026817162e61959) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix cursor pagination: @paginate path now wins over @list, listPaginated and direction are correctly computed for bidirectional cursor fields

- [#1639](https://github.com/HoudiniGraphql/houdini/pull/1639) [`b3798cd`](https://github.com/HoudiniGraphql/houdini/commit/b3798cde406da0f4160ee64e6026817162e61959) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - encode per-field pagination direction in pageInfo updates arrays; runtime now drives cache behavior from the artifact instead of hardcoded field names

## 2.0.0-next.19

### Patch Changes

- [#1638](https://github.com/HoudiniGraphql/houdini/pull/1638) [`d3856da`](https://github.com/HoudiniGraphql/houdini/commit/d3856daaae60cd73f4daae83e809a103ff14c5f2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix TS2554 in generated injectedPlugins.ts by omitting arguments when a client plugin's config is null

- [#1638](https://github.com/HoudiniGraphql/houdini/pull/1638) [`d3856da`](https://github.com/HoudiniGraphql/houdini/commit/d3856daaae60cd73f4daae83e809a103ff14c5f2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix several bugs in paginated connection artifact generation: `@paginate` on a nested field no longer produces an empty refetch path; `hasNextPage`/`hasPreviousPage` updates now propagate correctly; `endCursor`/`startCursor` no longer receive wrong-direction updates; and cache updates no longer leak to grandchildren of paginated connections

## 2.0.0-next.18

### Patch Changes

- [`a095fcc`](https://github.com/HoudiniGraphql/houdini/commit/a095fcc4eb51d6863a9cabc04b145fa96a53f240) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - publish wasm packages

## 2.0.0-next.17

### Patch Changes

- [#1631](https://github.com/HoudiniGraphql/houdini/pull/1631) [`86cecd1`](https://github.com/HoudiniGraphql/houdini/commit/86cecd19a8f54662624913400a6d82192639901b) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Bump dependencies to latest: graphql-yoga ^5, @whatwg-node/server ^0.11, minimatch ^10

- [#1633](https://github.com/HoudiniGraphql/houdini/pull/1633) [`f84e3cc`](https://github.com/HoudiniGraphql/houdini/commit/f84e3cc00c1c4c70acd0bac2087f08b16af3a879) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix TypeScript types for fragment masking on abstract/interface fields.

- [#1630](https://github.com/HoudiniGraphql/houdini/pull/1630) [`43d89e0`](https://github.com/HoudiniGraphql/houdini/commit/43d89e0a70b0daf8748ca9225a92b0b2b6bffa7a) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Added WebContainer compatible database layer

## 2.0.0-next.16

### Patch Changes

- [#1624](https://github.com/HoudiniGraphql/houdini/pull/1624) [`a8c43f7e`](https://github.com/HoudiniGraphql/houdini/commit/a8c43f7e830c0dfe55c808a76c34133f2e0f18cb) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix validation bug when field has default value defined in the schema

## 2.0.0-next.15

### Patch Changes

- [#1615](https://github.com/HoudiniGraphql/houdini/pull/1615) [`86124847`](https://github.com/HoudiniGraphql/houdini/commit/861248477429683de8f329bcb2a4da075b9d6122) Thanks [@github-actions](https://github.com/apps/github-actions)! - Fix package.json included in generated runtime

## 2.0.0-next.14

### Minor Changes

- [`ef91e5c1`](https://github.com/HoudiniGraphql/houdini/commit/ef91e5c1d00526fea772d3eae5661a8617fd79ce) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add scalar module imports, align DocumentHandle with fetching and errors fields

## 2.0.0-go.13

### Minor Changes

- [#1599](https://github.com/HoudiniGraphql/houdini/pull/1599) [`d4472272`](https://github.com/HoudiniGraphql/houdini/commit/d44722725c5e2302e041e3360020e386e098730f) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Bump Vite version

## 2.0.0-go.12

### Major Changes

- [#1593](https://github.com/HoudiniGraphql/houdini/pull/1593) [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Rewrote entire codegen pipeline in golang

## 2.0.0-go.11

### Patch Changes

- [#1597](https://github.com/HoudiniGraphql/houdini/pull/1597) [`7990ece2`](https://github.com/HoudiniGraphql/houdini/commit/7990ece2ed5d9a4b807ce2246b298f2777d0a6d9) Thanks [@siddarthvader](https://github.com/siddarthvader)! - generate artifacts pipeline deadlock condition resolve

## 2.0.0-go.10

### Patch Changes

- [#1595](https://github.com/HoudiniGraphql/houdini/pull/1595) [`3157a458`](https://github.com/HoudiniGraphql/houdini/commit/3157a458206bb15264b5fa124d7656c2257267de) Thanks [@siddarthvader](https://github.com/siddarthvader)! - Fix documents validation for schema that use custom operation types names for query/mutaiton/subscription

## 2.0.0-go.9

### Patch Changes

- [#1590](https://github.com/HoudiniGraphql/houdini/pull/1590) [`0610efa9`](https://github.com/HoudiniGraphql/houdini/commit/0610efa92e09344216bb1be1cf5610dbba3d570f) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Codegen pipeline now runs 5x faster

- [#1589](https://github.com/HoudiniGraphql/houdini/pull/1589) [`89252315`](https://github.com/HoudiniGraphql/houdini/commit/8925231525061d0fba35a6b78df5cfd2cde74920) Thanks [@github-actions](https://github.com/apps/github-actions)! - treat argument value seeds as roots in recursive CTE traversal

## 2.0.0-go.8

### Patch Changes

- [`c90c92b1`](https://github.com/HoudiniGraphql/houdini/commit/c90c92b1e5966b9756676abafc314b6b8e6439fe) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix compatability issue with go binary shim sand pnpm

## 2.0.0-go.7

### Patch Changes

- [`ae4cdfe4`](https://github.com/HoudiniGraphql/houdini/commit/ae4cdfe445503611ab56330fdc750f79a067ab8d) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix shim replacement for execution

## 2.0.0-go.6

### Patch Changes

- [`2d60bc70`](https://github.com/HoudiniGraphql/houdini/commit/2d60bc70818bdcbefd3ba177bb56fc69b33f90ea) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - rework postinstall script

## 2.0.0-go.5

### Patch Changes

- [`d66db310`](https://github.com/HoudiniGraphql/houdini/commit/d66db31026f37c1e8b5f661b8fbc05173b618a0e) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Attempt to fix post install script

## 2.0.0-go.4

### Patch Changes

- [`7822a62e`](https://github.com/HoudiniGraphql/houdini/commit/7822a62e0421192000dbdf55a1c4379cdfe29358) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix files entry in published package

## 2.0.0-go.3

### Patch Changes

- [`9bcf4188`](https://github.com/HoudiniGraphql/houdini/commit/9bcf4188dce2f153a07f3a9a47ffbd905def9da2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix shim paths

## 2.0.0-go.2

### Patch Changes

- [`a74bf5f8`](https://github.com/HoudiniGraphql/houdini/commit/a74bf5f803d97686d98b2d78f28ea542cb6f9448) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix inter-workspace deps

## 2.0.0-go.1

### Patch Changes

- [`07347a95`](https://github.com/HoudiniGraphql/houdini/commit/07347a9505ea11ba0d3e533979e96963b9001c06) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - bump houdini dep version

## 2.0.0-go.0

### Major Changes

- [`3af119a2`](https://github.com/HoudiniGraphql/houdini/commit/3af119a28ba88dd3b0e8902fdf94563354ebb765) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Implement new compiler architecture
