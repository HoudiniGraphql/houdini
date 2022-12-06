# houdini

## 0.17.14

## 0.17.13

## 0.17.12

## 0.17.11

## 0.17.10

## 0.17.9

### 🐛 Fixes

-   [#693](https://github.com/HoudiniGraphql/houdini/pull/693) [`6e36775`](https://github.com/HoudiniGraphql/houdini/commit/6e367755d902eca3242519b4c609c0d5bc76f4ff) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix bug causing `@parentID` to be ignored when there was only one version of the list

### ✨ Features

-   [#693](https://github.com/HoudiniGraphql/houdini/pull/693) [`6e36775`](https://github.com/HoudiniGraphql/houdini/commit/6e367755d902eca3242519b4c609c0d5bc76f4ff) Thanks [@jycouet](https://github.com/jycouet)! - Adding a new directive @allLists to update all lists after a mutation

## 0.17.6

### 🐛 Fixes

-   [#682](https://github.com/HoudiniGraphql/houdini/pull/682) [`57577ee`](https://github.com/HoudiniGraphql/houdini/commit/57577ee9144d17a5b357bf47abaecdf96a6176f8) Thanks [@Joklost](https://github.com/Joklost)! - Fix bug when updating deeply nested lists with @parentID

-   [#677](https://github.com/HoudiniGraphql/houdini/pull/677) [`927146d`](https://github.com/HoudiniGraphql/houdini/commit/927146dd02c239a9e29e5de92271d4c4de16d7e2) Thanks [@jycouet](https://github.com/jycouet)! - fix - env.TEST is not used internally anymore

### ✨ Features

-   [#687](https://github.com/HoudiniGraphql/houdini/pull/687) [`dc659ef`](https://github.com/HoudiniGraphql/houdini/commit/dc659efe1bc04a6ff98166b4803a50b8761771bb) Thanks [@jycouet](https://github.com/jycouet)! - update init cmd to manage remote endpoint and local files

## 0.17.5

### ✨ Features

-   [#660](https://github.com/HoudiniGraphql/houdini/pull/660) [`08b3d10`](https://github.com/HoudiniGraphql/houdini/commit/08b3d10c5305c43d457b11f288509e90459c2d0c) Thanks [@524c](https://github.com/524c)! - Add support for multipart file uploads

## 0.17.4

### 🐛 Fixes

-   [#649](https://github.com/HoudiniGraphql/houdini/pull/649) [`13e6ea8`](https://github.com/HoudiniGraphql/houdini/commit/13e6ea87c23d1a3f99ce1a0c1054ebcec30ce83f) Thanks [@jycouet](https://github.com/jycouet)! - Update init cmd to accomodate new kit template

## 0.17.1

### 🐛 Fixes

-   [#630](https://github.com/HoudiniGraphql/houdini/pull/630) [`02d8fc4`](https://github.com/HoudiniGraphql/houdini/commit/02d8fc47f71980bd2b6492162b8e57808447bdbc) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add shebang to executable

## 0.17.0

### ⚠️ Breaking Changes

-   [#593](https://github.com/HoudiniGraphql/houdini/pull/593) [`c1363fe`](https://github.com/HoudiniGraphql/houdini/commit/c1363fe938ab94281272cad8939b892fd705a803) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Split houdini into two packages: `houdini` and `houdini-svelte`. For more information on migrating your project, please visit the [release notes](https://www.houdinigraphql.com/guides/release-notes).

### 🐛 Fixes

-   [#612](https://github.com/HoudiniGraphql/houdini/pull/612) [`6a0999f`](https://github.com/HoudiniGraphql/houdini/commit/6a0999ff0fd175a190e156c54b37c4a70e402dbc) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix windows compatibility

## 0.16.8

### 🐛 Fixes

-   [#595](https://github.com/HoudiniGraphql/houdini/pull/595) [`3421404`](https://github.com/HoudiniGraphql/houdini/commit/3421404e58697bc8e066d3f0b2d9c74c77c0318a) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Don't consider the schema path as an source for generation

-   [#594](https://github.com/HoudiniGraphql/houdini/pull/594) [`4ee9db3`](https://github.com/HoudiniGraphql/houdini/commit/4ee9db312c8ef9db3244bcd2f10f877d596e6f8d) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fixed bug preventing documents from being discovered on windows

## 0.16.7

### 🐛 Fixes

-   [#585](https://github.com/HoudiniGraphql/houdini/pull/585) [`29a8fcd`](https://github.com/HoudiniGraphql/houdini/commit/29a8fcd31da3d80d8fa4386010591ba051c0f6e9) Thanks [@jycouet](https://github.com/jycouet)! - fix - windows paths correctly import things now

### ✨ Features

-   [#584](https://github.com/HoudiniGraphql/houdini/pull/584) [`2b19fe5`](https://github.com/HoudiniGraphql/houdini/commit/2b19fe578bca749ca975787709cfcc8325dec68a) Thanks [@sjcobb2022](https://github.com/sjcobb2022)! - Added further config to vite plugin

-   [#559](https://github.com/HoudiniGraphql/houdini/pull/559) [`fd570de`](https://github.com/HoudiniGraphql/houdini/commit/fd570debffde942220bed024676574af8d4d5372) Thanks [@DanielHritcu](https://github.com/DanielHritcu)! - Config.include and exclude can now be arrays

## 0.16.6

### 🐛 Fixes

-   [#572](https://github.com/HoudiniGraphql/houdini/pull/572) [`7d1f8b0`](https://github.com/HoudiniGraphql/houdini/commit/7d1f8b0a96d7352bcebbbf3ece242dad2c402f36) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix error causing subscriptions to be removed

-   [#572](https://github.com/HoudiniGraphql/houdini/pull/572) [`7d1f8b0`](https://github.com/HoudiniGraphql/houdini/commit/7d1f8b0a96d7352bcebbbf3ece242dad2c402f36) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix bug when importing store classes

### ✨ Features

-   [#563](https://github.com/HoudiniGraphql/houdini/pull/563) [`ad0ed5b`](https://github.com/HoudiniGraphql/houdini/commit/ad0ed5bcd476bb990ab08f351eed87bbf0cdd639) Thanks [@DanielHritcu](https://github.com/DanielHritcu)! - Warn user when the config file can't be read

*   [#569](https://github.com/HoudiniGraphql/houdini/pull/569) [`08f834a`](https://github.com/HoudiniGraphql/houdini/commit/08f834abff4637c023c9d7a208cd0c28976911b3) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Mutation result is never null

-   [#566](https://github.com/HoudiniGraphql/houdini/pull/566) [`a86ec3b`](https://github.com/HoudiniGraphql/houdini/commit/a86ec3b8ae57faf1f0bffd7e10ea82fdeb3883cb) Thanks [@sjcobb2022](https://github.com/sjcobb2022)! - Extra config passed to plugin is used when pulling schema

-   [#569](https://github.com/HoudiniGraphql/houdini/pull/569) [`08f834a`](https://github.com/HoudiniGraphql/houdini/commit/08f834abff4637c023c9d7a208cd0c28976911b3) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Subscription.listen arguments are optional

## 0.16.5

### 🐛 Fixes

-   [#557](https://github.com/HoudiniGraphql/houdini/pull/557) [`3690f4f`](https://github.com/HoudiniGraphql/houdini/commit/3690f4f081590e129e62b7499f6fa488fc067db1) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Configured pull headers are included in pull-schema command

*   [#553](https://github.com/HoudiniGraphql/houdini/pull/553) [`7666734`](https://github.com/HoudiniGraphql/houdini/commit/7666734110350fb7886eeeeec95108b61f88ece8) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fixed bug when loading offset-based pages driven by query variable

## 0.16.4

### 🐛 Fixes

-   [#548](https://github.com/HoudiniGraphql/houdini/pull/548) [`cd00b5f`](https://github.com/HoudiniGraphql/houdini/commit/cd00b5f436412ecc3ac2225d2ee8a9201b172da0) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix bug when reading store value between load and render

## 0.16.3

### 🐛 Fixes

-   [#545](https://github.com/HoudiniGraphql/houdini/pull/545) [`6cc6765`](https://github.com/HoudiniGraphql/houdini/commit/6cc6765771f57a51711725f3bed458a2ab338278) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix a bug hiding +layout.server data from client

## 0.16.2

### ✨ Features

-   [#534](https://github.com/HoudiniGraphql/houdini/pull/534) [`599fc3c`](https://github.com/HoudiniGraphql/houdini/commit/599fc3c9dc7843c40ab25b4c4763e1b3ed9df6c7) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Add ability to control masking for a specific fragment

### 🐛 Fixes

-   [#540](https://github.com/HoudiniGraphql/houdini/pull/540) [`8addece`](https://github.com/HoudiniGraphql/houdini/commit/8addecef1063dfe7d48f539d1c9f6b72949d7fd2) Thanks [@jycouet](https://github.com/jycouet)! - Warn users when endpoint is not present in dev instead of crashing

*   [#542](https://github.com/HoudiniGraphql/houdini/pull/542) [`3697e33`](https://github.com/HoudiniGraphql/houdini/commit/3697e33ec644f87f13878b74413b507843d90325) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix bug when loading queries in a layout file

-   [#539](https://github.com/HoudiniGraphql/houdini/pull/539) [`a7d4c2e`](https://github.com/HoudiniGraphql/houdini/commit/a7d4c2e9f650b86f8e19833079c286a64f807d2a) Thanks [@jycouet](https://github.com/jycouet)! - mono repo support

-   [#537](https://github.com/HoudiniGraphql/houdini/pull/537) [`191c775`](https://github.com/HoudiniGraphql/houdini/commit/191c7750a33b11cdbc8f5e7b9719641d5b0a21c5) Thanks [@jycouet](https://github.com/jycouet)! - init cmd, vite.config.ts generated file

## 0.16.1

### 🐛 Fixes

-   [#527](https://github.com/HoudiniGraphql/houdini/pull/527) [`9b87678`](https://github.com/HoudiniGraphql/houdini/commit/9b876789140978c0726ed9a708677c7c75f3e19b) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Update init command to work with latest file template

## 0.16.0

### ⚠️ Breaking Changes

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - remove inline document functions query, paginatedQuery, subscription, and mutation

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - renamed `generate --pull-header` to `generate --header` and `generate --persist-output` to `generate --output`

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - added support for page queries

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - inverted argument order for inline fragments

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Stores are now classes and need to be instantiated with `new MyQueryStore()`

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - query stores must now be passed to routes as props instead of globally imported

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - SvelteKit projects must now use houdini/vite as a vite plugin

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - `config.sourceGlob` has been renamed to `config.include` and is now optional. Also added `config.exclude` to filter out files matched by `config.include`

### ✨ Features

-   [#509](https://github.com/HoudiniGraphql/houdini/pull/509) [`4983a76`](https://github.com/HoudiniGraphql/houdini/commit/4983a76c46499acb98b73b3693c3e1f7da905ca9) Thanks [@jycouet](https://github.com/jycouet)! - warn users that inline functions no longer exist

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - You can now define the prefix of your global stores with globalStorePrefix param in the config.

*   [#508](https://github.com/HoudiniGraphql/houdini/pull/508) [`60ecb33`](https://github.com/HoudiniGraphql/houdini/commit/60ecb333a1396f9aa7244eac2f38741a58e7281f) Thanks [@fehnomenal](https://github.com/fehnomenal)! - added support for sessions

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - graphql tags return store references

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - add generated typedefs for route functions

-   [#494](https://github.com/HoudiniGraphql/houdini/pull/494) [`5573cfa`](https://github.com/HoudiniGraphql/houdini/commit/5573cfa184d2da322030695044997f5fbf6542bd) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - add onError hook

-   [#494](https://github.com/HoudiniGraphql/houdini/pull/494) [`5573cfa`](https://github.com/HoudiniGraphql/houdini/commit/5573cfa184d2da322030695044997f5fbf6542bd) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - add `quietQueryError` config value to suppress all query errors

### 🐛 Fixes

-   [#485](https://github.com/HoudiniGraphql/houdini/pull/485) [`c21942c`](https://github.com/HoudiniGraphql/houdini/commit/c21942c4a364dbaca4008dc0ad8263fdc940da84) Thanks [@jycouet](https://github.com/jycouet)! - fix peerDependencies of houdini, graphql needs to be <16

-   [#523](https://github.com/HoudiniGraphql/houdini/pull/523) [`2c5174c`](https://github.com/HoudiniGraphql/houdini/commit/2c5174c248bf2ae5ee3a8d3a7e910213e859ae2a) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix circular import with HoudiniClient

-   [#490](https://github.com/HoudiniGraphql/houdini/pull/490) [`71caba7`](https://github.com/HoudiniGraphql/houdini/commit/71caba7c6b23e73754934fd604030f3cd1a9b74b) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix generated types for optimistic responses

-   [#487](https://github.com/HoudiniGraphql/houdini/pull/487) [`0544a28`](https://github.com/HoudiniGraphql/houdini/commit/0544a2846125673f2f0e67cb02135554458edfb0) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix issues when rendering kit applications with framework set to "svelte"

## 0.15.9

### Patch Changes

-   [#443](https://github.com/HoudiniGraphql/houdini/pull/443) [`801d7e8`](https://github.com/HoudiniGraphql/houdini/commit/801d7e87f5199cb5e352001826d8f2d4c454bcc3) Thanks [@jycouet](https://github.com/jycouet)! - warn user when Node interface is not properly defined and throw an error on Node usage (when not properly defined)

## 0.15.8

### Patch Changes

-   [#434](https://github.com/HoudiniGraphql/houdini/pull/434) [`ebeb90e`](https://github.com/HoudiniGraphql/houdini/commit/ebeb90e1a9528b1b327bc161d26dc962ba7812bd) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - prevent store information from leaking across requests boundaries

*   [#434](https://github.com/HoudiniGraphql/houdini/pull/434) [`ebeb90e`](https://github.com/HoudiniGraphql/houdini/commit/ebeb90e1a9528b1b327bc161d26dc962ba7812bd) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - updated type definition for config file to allow for missing marshal/unmarshal functions

## 0.15.7

### Patch Changes

-   [#429](https://github.com/HoudiniGraphql/houdini/pull/429) [`d6d5c50`](https://github.com/HoudiniGraphql/houdini/commit/d6d5c50c2f4f0365a5939799fbcab4205fd99317) Thanks [@jycouet](https://github.com/jycouet)! - fix: unsub only when you have no active stores

## 0.15.6

### Patch Changes

-   [#426](https://github.com/HoudiniGraphql/houdini/pull/426) [`73b2467`](https://github.com/HoudiniGraphql/houdini/commit/73b2467e20f68b37ed0d3bb47f823361d685d026) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fixed bug when generating list operation types without masking

*   [#426](https://github.com/HoudiniGraphql/houdini/pull/426) [`73b2467`](https://github.com/HoudiniGraphql/houdini/commit/73b2467e20f68b37ed0d3bb47f823361d685d026) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - subscription.listen is a no-op on the server

-   [#423](https://github.com/HoudiniGraphql/houdini/pull/423) [`ff44c42`](https://github.com/HoudiniGraphql/houdini/commit/ff44c42220dbc50ca6e23a7a2e40a93bb32f7a24) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix bug when computing variables in component queries

*   [#419](https://github.com/HoudiniGraphql/houdini/pull/419) [`6363707`](https://github.com/HoudiniGraphql/houdini/commit/6363707d1a9471d9b8b62e8206d2660c316d9d05) Thanks [@jycouet](https://github.com/jycouet)! - feat: in summary a new log is displayed about what item was deleted

-   [#397](https://github.com/HoudiniGraphql/houdini/pull/397) [`ed764a2`](https://github.com/HoudiniGraphql/houdini/commit/ed764a235c81442babd9c153960d0ef5452f379c) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - update init script to detect tooling automatically

*   [#394](https://github.com/HoudiniGraphql/houdini/pull/394) [`96468da`](https://github.com/HoudiniGraphql/houdini/commit/96468dab8499085b9332044736b7c1b497d3fa58) Thanks [@david-plugge](https://github.com/david-plugge)! - export preprocessor types

-   [#392](https://github.com/HoudiniGraphql/houdini/pull/392) [`17e50a9`](https://github.com/HoudiniGraphql/houdini/commit/17e50a925188c499dc865fc2d16bc248713d5c90) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add variable store to inline query result

*   [#413](https://github.com/HoudiniGraphql/houdini/pull/413) [`8be5953`](https://github.com/HoudiniGraphql/houdini/commit/8be5953ae4237ef0f84346c595446ba8cd3feaee) Thanks [@jycouet](https://github.com/jycouet)! - improve: checking if you wrote an operation in a module, and warn you if it's the case

-   [#409](https://github.com/HoudiniGraphql/houdini/pull/409) [`6f99e1f`](https://github.com/HoudiniGraphql/houdini/commit/6f99e1fd826c8476f62644a3991380c805272c7f) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - improved preprocessor performance

*   [#405](https://github.com/HoudiniGraphql/houdini/pull/405) [`7eb7d39`](https://github.com/HoudiniGraphql/houdini/commit/7eb7d398174c796f6525de47aef08161e8b28ef3) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add support for query stores in endpoints

-   [#403](https://github.com/HoudiniGraphql/houdini/pull/403) [`97ea10d`](https://github.com/HoudiniGraphql/houdini/commit/97ea10dc8eeb81eff437fd51d4d1eceece7376a9) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix error when prerendering queries

*   [#416](https://github.com/HoudiniGraphql/houdini/pull/416) [`3f56c0d`](https://github.com/HoudiniGraphql/houdini/commit/3f56c0d6bf69690b617ce8d56c607acc5b6448b7) Thanks [@jycouet](https://github.com/jycouet)! - avoid clearing store state when there are all multiple subscribers

-   [#419](https://github.com/HoudiniGraphql/houdini/pull/419) [`6363707`](https://github.com/HoudiniGraphql/houdini/commit/6363707d1a9471d9b8b62e8206d2660c316d9d05) Thanks [@jycouet](https://github.com/jycouet)! - improve: generate will write files only if it has changed

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
