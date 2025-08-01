# houdini

## 1.5.10

### Patch Changes

-   [#1519](https://github.com/HoudiniGraphql/houdini/pull/1519) [`ff4590fb`](https://github.com/HoudiniGraphql/houdini/commit/ff4590fbced9d9aaba951d86e5c3766003a6f912) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Add notice redirecting users to houdini@next

-   [#1517](https://github.com/HoudiniGraphql/houdini/pull/1517) [`0acc49de`](https://github.com/HoudiniGraphql/houdini/commit/0acc49de8317e68cf350d07b0276a1af467d3252) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Export plugin static runtime types in .houdini/index.d.ts

## 1.5.9

### Patch Changes

-   [#1509](https://github.com/HoudiniGraphql/houdini/pull/1509) [`aa557d67`](https://github.com/HoudiniGraphql/houdini/commit/aa557d67cba6042d3a421bae9754ae2250257c3e) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Add schema path to gitignore file when setting up a project with a remote schema

## 1.5.8

### Patch Changes

-   [#1500](https://github.com/HoudiniGraphql/houdini/pull/1500) [`621074a8`](https://github.com/HoudiniGraphql/houdini/commit/621074a86a085a34b8df599f1b41382cac6f69e1) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix issue causing operation targets to be duplicated with paginated requests

## 1.5.7

### Patch Changes

-   [#1493](https://github.com/HoudiniGraphql/houdini/pull/1493) [`eb94ff4d`](https://github.com/HoudiniGraphql/houdini/commit/eb94ff4dae0488bb7d89a01af92217f666d1eca3) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Constraint maximum version of kit

## 1.5.6

### Patch Changes

-   [#1482](https://github.com/HoudiniGraphql/houdini/pull/1482) [`31108851`](https://github.com/HoudiniGraphql/houdini/commit/31108851d4a0c0480530807f4de751520fe35278) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix static runtime generation

## 1.5.5

### Patch Changes

-   [#1476](https://github.com/HoudiniGraphql/houdini/pull/1476) [`3fe26b17`](https://github.com/HoudiniGraphql/houdini/commit/3fe26b17dfb758e329a5d24876862f238e8c71f2) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Replace mentions of apiUrl with watchSchema url to prevent confusion

## 1.5.4

### Patch Changes

-   [#1450](https://github.com/HoudiniGraphql/houdini/pull/1450) [`09bef6c9`](https://github.com/HoudiniGraphql/houdini/commit/09bef6c915a7143ce9895447303f942b93e89dbf) Thanks [@rgon](https://github.com/rgon)! - fix internal circular dependencies

## 1.5.3

### Patch Changes

-   [#1445](https://github.com/HoudiniGraphql/houdini/pull/1445) [`0eced73c`](https://github.com/HoudiniGraphql/houdini/commit/0eced73c7494c9409f3bb69f1766c02f555d30ca) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Fix config exclude not excluding absolute paths correctly

## 1.5.2

### Patch Changes

-   [#1441](https://github.com/HoudiniGraphql/houdini/pull/1441) [`0e02fa8a`](https://github.com/HoudiniGraphql/houdini/commit/0e02fa8a043cdb092515835bcc7d9e2c9546678c) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Loosen typing requirements for SubscriptionClient to fix compatibility with graphql-sse

## 1.5.1

### Patch Changes

-   [#1433](https://github.com/HoudiniGraphql/houdini/pull/1433) [`faf0a5cb`](https://github.com/HoudiniGraphql/houdini/commit/faf0a5cb0f3cd5936923bf981a6022875b3ec1cb) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Update init script to only update the necessary fields

## 1.5.0

### Minor Changes

-   [#1430](https://github.com/HoudiniGraphql/houdini/pull/1430) [`142cc664`](https://github.com/HoudiniGraphql/houdini/commit/142cc664ff6581bdaf4433222f0bcc8cfe82fee1) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Fix vite peerdependency versions

### Patch Changes

-   [#1428](https://github.com/HoudiniGraphql/houdini/pull/1428) [`ab8932e2`](https://github.com/HoudiniGraphql/houdini/commit/ab8932e22126a5b3c6f32e184eef53f15324e56f) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Fix document paths on windows not being properly posixified

## 1.4.3

### Patch Changes

-   [#1426](https://github.com/HoudiniGraphql/houdini/pull/1426) [`711358eb`](https://github.com/HoudiniGraphql/houdini/commit/711358eb0bf368c46b5543c36342e506d4d898ae) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add abortController argument to query and mutation handles

## 1.4.2

### Patch Changes

-   [#1421](https://github.com/HoudiniGraphql/houdini/pull/1421) [`1f11803e`](https://github.com/HoudiniGraphql/houdini/commit/1f11803e98ad9aada1b4fb068a51af7948e82da0) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Ensure pageInfo is always included with connection selections

-   [#1422](https://github.com/HoudiniGraphql/houdini/pull/1422) [`47f89581`](https://github.com/HoudiniGraphql/houdini/commit/47f895810a2340fe898f0c4fc4605e890f48fc9f) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix bug causing dev serer to crash if there are syntax errors in a local schema

-   [#1418](https://github.com/HoudiniGraphql/houdini/pull/1418) [`f07875bf`](https://github.com/HoudiniGraphql/houdini/commit/f07875bf1e50370cdfdb762eae9311f0cc1e680f) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Bump deprecated dependency version

-   [#1398](https://github.com/HoudiniGraphql/houdini/pull/1398) [`3d78749f`](https://github.com/HoudiniGraphql/houdini/commit/3d78749f4f917ee7e6edfa948ab62a1544f7d432) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Move svelte, sveltekit and vite into peerDependencies

## 1.4.1

### Patch Changes

-   [#1415](https://github.com/HoudiniGraphql/houdini/pull/1415) [`d0b11685`](https://github.com/HoudiniGraphql/houdini/commit/d0b116852871af258a8c6a33ede6858c04295f70) Thanks @AlecAivazis! - Include pageInfo in default pagination fields

-   [#1415](https://github.com/HoudiniGraphql/houdini/pull/1415) [`d0b11685`](https://github.com/HoudiniGraphql/houdini/commit/d0b116852871af258a8c6a33ede6858c04295f70) Thanks @AlecAivazis! - Fix issue when multiple operations targetting the same list are found in a mutation

-   [#1407](https://github.com/HoudiniGraphql/houdini/pull/1407) [`d7b30f00`](https://github.com/HoudiniGraphql/houdini/commit/d7b30f00aaf974068a4a3b61a353bf2f9fa405e4) Thanks @Mtn-View! - Fix error bug JSON response might get treated as non-JSON if it includes `charset` or `boundary`

## 1.4.0

### Minor Changes

-   [#1402](https://github.com/HoudiniGraphql/houdini/pull/1402) [`21316ede`](https://github.com/HoudiniGraphql/houdini/commit/21316ede86e52dbdc3d0de7952385f9cb8307f46) Thanks @SeppahBaws! - Add support for vite 6

-   [#1386](https://github.com/HoudiniGraphql/houdini/pull/1386) [`3c08996a`](https://github.com/HoudiniGraphql/houdini/commit/3c08996a17177937fb3cf97185660c9dda3c5cde) Thanks @endigma! - Added support for configuring Houdini's output directory

### Patch Changes

-   [#1404](https://github.com/HoudiniGraphql/houdini/pull/1404) [`d6375b6b`](https://github.com/HoudiniGraphql/houdini/commit/d6375b6b04ecd48fba663e83b3aed9b6b25e51b3) Thanks @Mtn-View! - Throw the semantic HTTP error code and message when receiving a non-JSON error response from the server

-   [#1378](https://github.com/HoudiniGraphql/houdini/pull/1378) [`d2dbcd2d`](https://github.com/HoudiniGraphql/houdini/commit/d2dbcd2de9b77b855053ea7775dff1207eb60a4c) Thanks @AlecAivazis! - Add match argument to dedupe directive

## 1.3.1

### Patch Changes

-   [#1384](https://github.com/HoudiniGraphql/houdini/pull/1384) [`70dab292`](https://github.com/HoudiniGraphql/houdini/commit/70dab292b4590183f7c0ccfa3731c28c4ea3f6b1) Thanks @ewen-lbh! - Don't crash dev server when a schema loading error occurs

-   [#1382](https://github.com/HoudiniGraphql/houdini/pull/1382) [`24e6bef9`](https://github.com/HoudiniGraphql/houdini/commit/24e6bef9a28875e0026f9aa1ef0e71aba17447e2) Thanks @gschulze! - Support GraphQL files with \*.graphqls extension

-   [#1376](https://github.com/HoudiniGraphql/houdini/pull/1376) [`fa869cea`](https://github.com/HoudiniGraphql/houdini/commit/fa869ceab903190f7c098bb02e7f838a3609e947) Thanks @SeppahBaws! - Fix init script using incorrect version for houdini-svelte plugin

## 1.3.0

### Minor Changes

-   [#1373](https://github.com/HoudiniGraphql/houdini/pull/1373) [`45b9bb80`](https://github.com/HoudiniGraphql/houdini/commit/45b9bb80fdecd80c788cc2be7157c64ef3a43a22) Thanks @SeppahBaws! - Add support for Svelte 5 and Svelte Runes

### Patch Changes

-   [#1373](https://github.com/HoudiniGraphql/houdini/pull/1373) [`45b9bb80`](https://github.com/HoudiniGraphql/houdini/commit/45b9bb80fdecd80c788cc2be7157c64ef3a43a22) Thanks @SeppahBaws! - Bump Svelte version to 5.0

## 1.3.0-next.0

### Minor Changes

-   [#1300](https://github.com/HoudiniGraphql/houdini/pull/1300) [`c39d14d0`](https://github.com/HoudiniGraphql/houdini/commit/c39d14d0ac721248789bef1a46af9a460740cf26) Thanks @SeppahBaws! - Add support for Svelte 5 and Svelte Runes

### Patch Changes

-   [`9fe06516`](https://github.com/HoudiniGraphql/houdini/commit/9fe06516becca5803b70c4455ee4a68a1ff1ad42) Thanks @SeppahBaws! - Bump Svelte version to 5.0

## 1.2.64

## 1.2.63

## 1.2.62

### Patch Changes

-   [#1352](https://github.com/HoudiniGraphql/houdini/pull/1352) [`2cf22c7c`](https://github.com/HoudiniGraphql/houdini/commit/2cf22c7ccae088b107770b819d2c0019054d3c6e) Thanks @AlecAivazis! - Add @dedupe directive

## 1.2.61

## 1.2.60

## 1.2.59

## 1.2.58

## 1.2.57

### Patch Changes

-   [#1350](https://github.com/HoudiniGraphql/houdini/pull/1350) [`fe0d7599`](https://github.com/HoudiniGraphql/houdini/commit/fe0d75996ac5632fe8a10dde85a3f59b036dd3c7) Thanks @AlecAivazis! - Fix bug when generating fresh project files with a local schema

## 1.2.56

### Patch Changes

-   [#1343](https://github.com/HoudiniGraphql/houdini/pull/1343) [`1728454f`](https://github.com/HoudiniGraphql/houdini/commit/1728454f0f1ca6a35ad5c4c039cc6e2f6212ab25) Thanks @AlecAivazis! - Fix bug when 2 different lists are inserted in the same operation

## 1.2.55

### Patch Changes

-   [#1339](https://github.com/HoudiniGraphql/houdini/pull/1339) [`98859e78`](https://github.com/HoudiniGraphql/houdini/commit/98859e78e088cf733edc35b3ad96b1a1f9f48b79) Thanks @AlecAivazis! - Fix circular import in generated runtime

-   [#1337](https://github.com/HoudiniGraphql/houdini/pull/1337) [`5add29a6`](https://github.com/HoudiniGraphql/houdini/commit/5add29a68489fd9382d0809cf574a1db2746aae8) Thanks @AlecAivazis! - Various fixes for optimistic use cases

## 1.2.54

## 1.2.53

### Patch Changes

-   [#1332](https://github.com/HoudiniGraphql/houdini/pull/1332) [`389de558`](https://github.com/HoudiniGraphql/houdini/commit/389de558fa52ed0ec6fd37f1aac1d3e12da9da02) Thanks @AlecAivazis! - More fixes for outbound unused variables

## 1.2.52

### Patch Changes

-   [#1330](https://github.com/HoudiniGraphql/houdini/pull/1330) [`69b7781e`](https://github.com/HoudiniGraphql/houdini/commit/69b7781e11b0824081be8a863a574d176d6bd138) Thanks @AlecAivazis! - Strip unused variables on their way to the server

## 1.2.51

### Patch Changes

-   [#1328](https://github.com/HoudiniGraphql/houdini/pull/1328) [`90901979`](https://github.com/HoudiniGraphql/houdini/commit/90901979bbd7f70df166b21f5fe7cf0ffc71ad1d) Thanks @AlecAivazis! - Add necessary infrastructure to support spa adapter

## 1.2.50

### Patch Changes

-   [#1318](https://github.com/HoudiniGraphql/houdini/pull/1318) [`75999ca0`](https://github.com/HoudiniGraphql/houdini/commit/75999ca0a1a743579351a9b8a04b26dc31b1dc3c) Thanks @AlecAivazis! - Add @optimisticKey decorator

## 1.2.49

### Patch Changes

-   [#1324](https://github.com/HoudiniGraphql/houdini/pull/1324) [`a0a67eab`](https://github.com/HoudiniGraphql/houdini/commit/a0a67eab658acf1108049d5f2c304ef335716082) Thanks @SeppahBaws! - Add a configurable timeout to to fetching the remote schema

-   [#1322](https://github.com/HoudiniGraphql/houdini/pull/1322) [`c9a019de`](https://github.com/HoudiniGraphql/houdini/commit/c9a019ded20018116dde50f50f1e4d31dd89e189) Thanks @SeppahBaws! - Make sure lists of custom scalars are unmarshaled item per item instead of as one list

-   [#1319](https://github.com/HoudiniGraphql/houdini/pull/1319) [`ba4be40f`](https://github.com/HoudiniGraphql/houdini/commit/ba4be40f6b5820582bf1ca213a36babbba1e55c3) Thanks @AlecAivazis! - Add -o argument to pull-schema for specifying the file path

## 1.2.48

### Patch Changes

-   [#1312](https://github.com/HoudiniGraphql/houdini/pull/1312) [`e21f7c6a`](https://github.com/HoudiniGraphql/houdini/commit/e21f7c6a700eafe7c2eaa5f9ce6856a64f5abba7) @SeppahBaws - Fix "Cannot read properties of undefined (reading 'watchFiles')" error using vite 5.3

## 1.2.47

### 🐛 Fixes

-   [#1296](https://github.com/HoudiniGraphql/houdini/pull/1296) [`e6368686`](https://github.com/HoudiniGraphql/houdini/commit/e6368686cd283f46c77755efb70701aa1da729fe) Thanks @AlecAivazis! - Fix memory leak in cache's reference counting

## 1.2.46

### ✨ Features

-   [#1286](https://github.com/HoudiniGraphql/houdini/pull/1286) [`f45e9126`](https://github.com/HoudiniGraphql/houdini/commit/f45e9126e2481cfcd67043e1f5bd7bef6575acaf) @Hebilicious - add support for the new 'using' syntax (explicit resource management: https://github.com/tc39/proposal-explicit-resource-management)

### 🐛 Fixes

-   [#1289](https://github.com/HoudiniGraphql/houdini/pull/1289) [`6820d36e`](https://github.com/HoudiniGraphql/houdini/commit/6820d36ea4f452f904319a322afa44f6765b5285) @SeppahBaws - Mutation list operations now work if you need to pass a `@with` directive to the fragment spread

## 1.2.45

### ✨ Features

-   [#1277](https://github.com/HoudiniGraphql/houdini/pull/1277) [`7f426d94`](https://github.com/HoudiniGraphql/houdini/commit/7f426d94bc13d061c39e19310f6e5de48ea4e219) @ewen-lbh - GraphQL documentation strings and deprecation reasons are reflected as JSDoc comments on generated type definitions. Hover over any field of a query store, an enum, or an enum's value and your IDE should show you the documentation from the GraphQL API.

## 1.2.44

### 🐛 Fixes

-   [#1279](https://github.com/HoudiniGraphql/houdini/pull/1279) [`50a9fa13`](https://github.com/HoudiniGraphql/houdini/commit/50a9fa13958a8dd0becbd66f2b3f3437aae0aa1d) @SeppahBaws - Fix init script to use the correct vitePreprocess import

### ✨ Features

-   [#1280](https://github.com/HoudiniGraphql/houdini/pull/1280) [`4e31fbba`](https://github.com/HoudiniGraphql/houdini/commit/4e31fbba4faea5e98fda8befcedce76d71e6849b) Thanks @AlecAivazis! - Add experimental support for RuntimeScalars

## 1.2.43

## 1.2.42

## 1.2.41

## 1.2.40

## 1.2.39

### ✨ Features

-   [#1267](https://github.com/HoudiniGraphql/houdini/pull/1267) [`45c66b33`](https://github.com/HoudiniGraphql/houdini/commit/45c66b334edc749c889b74103221f726350d8025) Thanks @AlecAivazis! - Add support for non-string IDs when using the delete directive

## 1.2.38

### ✨ Features

-   [#1265](https://github.com/HoudiniGraphql/houdini/pull/1265) [`a84b7c5f`](https://github.com/HoudiniGraphql/houdini/commit/a84b7c5f9a2f5cc5ec806afef5cd4e640a9bbfb5) @MattiasMartens - Implement cache policy "NoCache"

### 🐛 Fixes

-   [#1263](https://github.com/HoudiniGraphql/houdini/pull/1263) [`d22a395d`](https://github.com/HoudiniGraphql/houdini/commit/d22a395d2b4295a1db3c0e9ce61c5be8e57197fa) @SeppahBaws - Ensure houdini generate exits with 1 in case of errors

## 1.2.37

### ✨ Features

-   [#1253](https://github.com/HoudiniGraphql/houdini/pull/1253) [`21ef04bf`](https://github.com/HoudiniGraphql/houdini/commit/21ef04bffce6e22a49e0294e1618a2a9f879f43d) @SeppahBaws - Add support for required arguments in paginated fragments

### 🐛 Fixes

-   [#1261](https://github.com/HoudiniGraphql/houdini/pull/1261) [`d1899949`](https://github.com/HoudiniGraphql/houdini/commit/d18999499ef3b773a4654363e625dcc04db5d291) Thanks @AlecAivazis! - Fix parsing error with export type \* from

-   [#1260](https://github.com/HoudiniGraphql/houdini/pull/1260) [`5cf1c72e`](https://github.com/HoudiniGraphql/houdini/commit/5cf1c72e4f1e5c585d05bcbdc67095d8aa68bd32) Thanks @AlecAivazis! - fix bug when fragment arguments are passed to directives

## 1.2.36

-   [#1249](https://github.com/HoudiniGraphql/houdini/pull/1249) [`ffa2b2a6`](https://github.com/HoudiniGraphql/houdini/commit/ffa2b2a6af6c06281923e14bd3d53bf54ec33792) @llJochemll - Optimize cache subscriptions

## 1.2.35

### 🐛 Fixes

-   [#1244](https://github.com/HoudiniGraphql/houdini/pull/1244) [`c86501ae`](https://github.com/HoudiniGraphql/houdini/commit/c86501ae87b8d2a64946711ba842459d941eccf9) @SeppahBaws - Fix nested fragment fields getting masked out when using fragment arguments

## 1.2.34

## 1.2.33

### 🐛 Fixes

-   [#1226](https://github.com/HoudiniGraphql/houdini/pull/1226) [`1a736fc2`](https://github.com/HoudiniGraphql/houdini/commit/1a736fc23aefbfcc7b003d5d1d194ee37c8a8ecb) Thanks @AlecAivazis! - Fix bug causing inifinite loops in vite dev server

## 1.2.32

### ✨ Features

-   [#1223](https://github.com/HoudiniGraphql/houdini/pull/1223) [`ae73932d`](https://github.com/HoudiniGraphql/houdini/commit/ae73932da26e9e960dfeb916536048ab99701e98) Thanks @AlecAivazis! - Plugin runtimes are now generated before documents are collected

## 1.2.31

## 1.2.28

## 1.2.27

## 1.2.26

## 1.2.25

## 1.2.24

## 1.2.23

## 1.2.22

### 🐛 Fixes

-   [#1193](https://github.com/HoudiniGraphql/houdini/pull/1193) [`c0fef15f`](https://github.com/HoudiniGraphql/houdini/commit/c0fef15f892d7398f2cae3deac82f0801d04e3bb) @AlecAivazis- Fix bug causing prev and next keys to be dropped from artifact

## 1.2.21

### 🐛 Fixes

-   [#1190](https://github.com/HoudiniGraphql/houdini/pull/1190) [`2cc489dd`](https://github.com/HoudiniGraphql/houdini/commit/2cc489dd266e5670cc54975b3720498b3fffbe50) @AlecAivazis- Few random deployment fixes

## 1.2.20

## 1.2.19

## 1.2.18

### Patch Changes

-   [`7f6432a6`](https://github.com/HoudiniGraphql/houdini/commit/7f6432a6be5bd7bb7831f21ebe134698f1e2f072) Thanks @AlecAivazis! - Get all packages at same version

## 1.2.17

## 1.2.16

## 1.2.15

## 1.2.14

### ✨ Features

-   [#1172](https://github.com/HoudiniGraphql/houdini/pull/1172) [`386fc4c5`](https://github.com/HoudiniGraphql/houdini/commit/386fc4c5b604a40586aba47533f83a1f5a3723d9) @jycouet - Node interface arg can be customized with the first defaultKeys defined in houdini.config.js

## 1.2.13

### 🐛 Fixes

-   [#1169](https://github.com/HoudiniGraphql/houdini/pull/1169) [`41e3bdbf`](https://github.com/HoudiniGraphql/houdini/commit/41e3bdbf9a1bcc029fb8ef56fe91f7116a42a3b1) Thanks @AlecAivazis! - fixed a bug when fragment variables were set to structured values

-   [#1167](https://github.com/HoudiniGraphql/houdini/pull/1167) [`8741ff3a`](https://github.com/HoudiniGraphql/houdini/commit/8741ff3a1594c79400a99f102e8d84801d44ae87) Thanks @AlecAivazis! - Fix bug in init causing it to always crash

## 1.2.12

## 1.2.11

## 1.2.10

### ✨ Features

-   [#1155](https://github.com/HoudiniGraphql/houdini/pull/1155) [`adf90d3`](https://github.com/HoudiniGraphql/houdini/commit/adf90d3c3406c79c9b07060c764bf41289bf2a38) Thanks @AlecAivazis! - Add adapter infrastructure when building for production

-   [#1155](https://github.com/HoudiniGraphql/houdini/pull/1155) [`adf90d3`](https://github.com/HoudiniGraphql/houdini/commit/adf90d3c3406c79c9b07060c764bf41289bf2a38) Thanks @AlecAivazis! - Add cloudflare adapter

## 1.2.9

## 1.2.8

### 🐛 Fixes

-   [#1133](https://github.com/HoudiniGraphql/houdini/pull/1133) @SeppahBaws - Fix cache read and write input param types being generated incorrectly

## 1.2.7

### ✨ Features

-   [#1090](https://github.com/HoudiniGraphql/houdini/pull/1090) [`18571f8`](https://github.com/HoudiniGraphql/houdini/commit/18571f81faffeda311c6f6125c2b2ad17f6cc66e) @jycouet! - Persisted Queries File can be generated on each changes via `PersistedQueriesPath` param in the config file.

### 🐛 Fixes

-   [#1090](https://github.com/HoudiniGraphql/houdini/pull/1090) [`18571f8`](https://github.com/HoudiniGraphql/houdini/commit/18571f81faffeda311c6f6125c2b2ad17f6cc66e) @jycouet! - Artifact Hash and Hashes in the generated file are now matching

-   [#1123](https://github.com/HoudiniGraphql/houdini/pull/1123) [`2d2d6c7`](https://github.com/HoudiniGraphql/houdini/commit/2d2d6c779aca76af375f57644027954e89886d7d) @Morstis - Fix bug when multiple subscriptions are present on the same page

-   [#1121](https://github.com/HoudiniGraphql/houdini/pull/1121) [`8618b66`](https://github.com/HoudiniGraphql/houdini/commit/8618b6631a8f51f6c4f6724199e25a5f8e05d0b5) @Morstis - Fix bug when fragment arguments are deeply nested in object values

## 1.2.6

### ✨ Features

-   [#1107](https://github.com/HoudiniGraphql/houdini/pull/1107) [`743d85d`](https://github.com/HoudiniGraphql/houdini/commit/743d85d1490128dd3d9c7a419efdc4b65f996418) @m4tr1k - Add method to reset cache state

-   [#1120](https://github.com/HoudiniGraphql/houdini/pull/1120) [`91b445f`](https://github.com/HoudiniGraphql/houdini/commit/91b445f0c1d9e35608e9f3c76ad5cbf51ff93217) Thanks @AlecAivazis! - Users can specify that a type is always embedded by setting keys to []

### 🐛 Fixes

-   [#1109](https://github.com/HoudiniGraphql/houdini/pull/1109) [`1fc47b8`](https://github.com/HoudiniGraphql/houdini/commit/1fc47b8f1528aa9f24f3604a8fb3794f95d9754e) @canastro @AlecAivazis - Fix issue with duplicate abstract selections

-   [#1103](https://github.com/HoudiniGraphql/houdini/pull/1103) [`891a8c7`](https://github.com/HoudiniGraphql/houdini/commit/891a8c72b89af39f17b402485cea642946375278) @canastro @AlecAivazis - Fix issue with inserts in lists of union

-   [#1111](https://github.com/HoudiniGraphql/houdini/pull/1111) [`35cc897`](https://github.com/HoudiniGraphql/houdini/commit/35cc897cb98d3952139d9f06fb6bcba40c249ccd) Thanks @AlecAivazis! - Fix issue when writing over previously null value

## 1.2.5

### 🐛 Fixes

-   [#1100](https://github.com/HoudiniGraphql/houdini/pull/1100) [`bc96dfb`](https://github.com/HoudiniGraphql/houdini/commit/bc96dfb78e8df7e57c2cca7aee88a32d38c7565e) Thanks @jycouet! - Support projects using `experimentalDecorators: true` flag in there tsconfig.json

-   [#1098](https://github.com/HoudiniGraphql/houdini/pull/1098) [`cb0310c`](https://github.com/HoudiniGraphql/houdini/commit/cb0310c3467d170a9a0cf012787bd59272b1e8bb) Thanks @jycouet! - fix: config.include now checks against files ignoring QueryString

## 1.2.4

### 🐛 Fixes

-   [#1096](https://github.com/HoudiniGraphql/houdini/pull/1096) Thanks @AlecAivazis! - Fix bug when inserting data into abstract list

## 1.2.3

### ✨ Features

-   #1075 [`1e98daf`](https://github.com/HoudiniGraphql/houdini/commit/1e98daff3dd420e86fb913a01d34644316c57955) Thanks @jycouet! - it's now possible to use @allLists on \_remove fragment

### 🐛 Fixes

-   #1075 [`1e98daf`](https://github.com/HoudiniGraphql/houdini/commit/1e98daff3dd420e86fb913a01d34644316c57955) Thanks @jycouet! - Fix various issues reverting optimistic operations

## 1.2.2

### 🐛 Fixes

-   #1070 [`6958699`](https://github.com/HoudiniGraphql/houdini/commit/6958699d8e685dd129cbcc09d2f9099c9353bd12) Thanks @AlecAivazis! - Fix bug when fragment spread on abstract inline

## 1.2.1

### 🐛 Fixes

-   [#1067](https://github.com/HoudiniGraphql/houdini/pull/1067) [`5f3bc42`](https://github.com/HoudiniGraphql/houdini/commit/5f3bc42dcd1cf4f8dddd45e8064e5f3a994c6eeb) Thanks @HanielU! - Fix bug causing svelte files to be parsed as jsx

-   [#1063](https://github.com/HoudiniGraphql/houdini/pull/1063) [`c0bc1fc`](https://github.com/HoudiniGraphql/houdini/commit/c0bc1fc46c571a4df5cae0b7c7a1f87589f11997) Thanks @scottBowles! - Fix bug when fragments spanned abstract boundaries inside of inline fragment

## 1.2.0

### ✨ Features

-   [#1043](https://github.com/HoudiniGraphql/houdini/pull/1043) [`d92bfc0`](https://github.com/HoudiniGraphql/houdini/commit/d92bfc02e8419914d6c347714d08b0251f6081e9) Thanks @AlecAivazis! - Add loading directive to help construct loading interfaces

-   [#987](https://github.com/HoudiniGraphql/houdini/pull/987) [`7d624fe`](https://github.com/HoudiniGraphql/houdini/commit/7d624fec9417152ec2560b36efbcc21bd694e378) Thanks [@tadeokondrak](https://github.com/tadeokondrak)! - Add @required directive to force nullable fields to bubble up

-   [#1016](https://github.com/HoudiniGraphql/houdini/pull/1016) [`31e8f6d`](https://github.com/HoudiniGraphql/houdini/commit/31e8f6d8072ebc7e30921b9cc811b5b568f03017) Thanks [@jycouet](https://github.com/jycouet)! - Add additional configuration values and directives to control route's blocking behavior.

-   [#1049](https://github.com/HoudiniGraphql/houdini/pull/1049) [`7161781`](https://github.com/HoudiniGraphql/houdini/commit/71617814116ce4ead9fce2c7aeef2391a952f8a5) Thanks [@devunt](https://github.com/devunt)! - Send `operationName` along with the `query` and `variables` by default.

### 🐛 Fixes

-   [#1048](https://github.com/HoudiniGraphql/houdini/pull/1048) [`184ddbd`](https://github.com/HoudiniGraphql/houdini/commit/184ddbdf0e82da56b479c5009f105f04fd6ac00e) Thanks [@mpellegrini](https://github.com/mpellegrini)! - Include explicit types export conditions in package.json exports

## 1.1.7

### ✨ Features

-   [#1037](https://github.com/HoudiniGraphql/houdini/pull/1037) [`151a107`](https://github.com/HoudiniGraphql/houdini/commit/151a10718b92fb97eec6e94ea12efc7f98928755) Thanks [@devunt](https://github.com/devunt)! - Add support for Yarn's PnP mode

## 1.1.6

### 🐛 Fixes

-   [#1036](https://github.com/HoudiniGraphql/houdini/pull/1036) [`f0c11433`](https://github.com/HoudiniGraphql/houdini/commit/f0c11433a1403e9e0a2d53031f23483fa3e486df) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Make sure fragment arguments get marshaled properly

## 1.1.5

### 🐛 Fixes

-   [#1032](https://github.com/HoudiniGraphql/houdini/pull/1032) [`5305a2ad`](https://github.com/HoudiniGraphql/houdini/commit/5305a2ad36e692d47f5fb4cfa2c5a2e4d9ef3d4d) Thanks @AlecAivazis! - Fix template files created by init command

-   [#1031](https://github.com/HoudiniGraphql/houdini/pull/1031) [`5a6e188d`](https://github.com/HoudiniGraphql/houdini/commit/5a6e188d88a4b7f84511a84ddc1bcc2c1ff59f5f) Thanks @AlecAivazis! - Fix bug with fragment arguments when the same fragment/argument combo was multiple times

-   [#1033](https://github.com/HoudiniGraphql/houdini/pull/1033) [`be51b0f5`](https://github.com/HoudiniGraphql/houdini/commit/be51b0f5e5fdde4f48288bfcede2c46b4bddf01f) Thanks [@devunt](https://github.com/devunt)! - Fix passing `null` over `watchSchema.interval` in the configuration does not work as expected

## 1.1.4

### 🐛 Fixes

-   [#1027](https://github.com/HoudiniGraphql/houdini/pull/1027) [`184a8417`](https://github.com/HoudiniGraphql/houdini/commit/184a84170bc803c37cd25993c9877a2187c91da3) Thanks @AlecAivazis! - Fix bug when fragment arguments are nested in objects

-   [#1022](https://github.com/HoudiniGraphql/houdini/pull/1022) [`16b8b882`](https://github.com/HoudiniGraphql/houdini/commit/16b8b882c66c96942bd5f4f3fddaffc62a30d8fa) Thanks @AlecAivazis! - Fix bug causing fragment masking to confuse partial cache hits

-   [#1019](https://github.com/HoudiniGraphql/houdini/pull/1019) [`dfc4295a`](https://github.com/HoudiniGraphql/houdini/commit/dfc4295a5bc20fdcc24b671f1faa910b5e91ba61) Thanks @AlecAivazis! - Fix bug with include and skip directives

## 1.1.3

## 1.1.2

### 🐛 Fixes

-   [#1000](https://github.com/HoudiniGraphql/houdini/pull/1000) [`09c35bb6`](https://github.com/HoudiniGraphql/houdini/commit/09c35bb60a605894c8360037e757280f0b899bc3) Thanks @AlecAivazis! - Fix bug with fragments that rely on abstract selections

-   [#966](https://github.com/HoudiniGraphql/houdini/pull/966) [`f7fd8777`](https://github.com/HoudiniGraphql/houdini/commit/f7fd87770178014f49d6f50f86a7402269642f21) Thanks [@jycouet](https://github.com/jycouet)! - Fix bug when reverting optimistic responses containing list operations

## 1.1.1

### ✨ Features

-   [#995](https://github.com/HoudiniGraphql/houdini/pull/995) [`54e8c453`](https://github.com/HoudiniGraphql/houdini/commit/54e8c4535ce7b9d0d29f9ef4073e173652bf0cb3) Thanks [@fnimick](https://github.com/fnimick)! - Add explicit error for multiple operations/fragments in a single document

## 1.1.0

### ✨ Features

-   [#954](https://github.com/HoudiniGraphql/houdini/pull/954) [`f94b6ca`](https://github.com/HoudiniGraphql/houdini/commit/f94b6caf8bda21fdbe22b466dc01cb8f8f40448f) Thanks @AlecAivazis! - Improve performance by using fragments for fine-grain reactivity

## 1.0.11

## 1.0.10

### 🐛 Fixes

-   [#974](https://github.com/HoudiniGraphql/houdini/pull/974) [`38a54b8f`](https://github.com/HoudiniGraphql/houdini/commit/38a54b8f6858e35bb6bdf7a09c357959675a555a) Thanks @AlecAivazis! - Fix cache instability flag verification

## 1.0.9

## 1.0.8

### ✨ Features

-   [#961](https://github.com/HoudiniGraphql/houdini/pull/961) [`3240b8e`](https://github.com/HoudiniGraphql/houdini/commit/3240b8e0719c5dffb0d6034ea7ad4b3615b01faa) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Pass ctx to error handler in throwOnError

-   [#958](https://github.com/HoudiniGraphql/houdini/pull/958) [`8e2f8e0`](https://github.com/HoudiniGraphql/houdini/commit/8e2f8e0d5b96f34a01dfcbc510ab1b0c3cfa9822) Thanks [@jycouet](https://github.com/jycouet)! - new feature: paginate directive now supports a SinglePage mode (in addition to the Infinite one already present)

### 🐛 Fixes

-   [#964](https://github.com/HoudiniGraphql/houdini/pull/964) [`b223c60`](https://github.com/HoudiniGraphql/houdini/commit/b223c6079bb4a19d5708ad7daf905fe913dbec1e) Thanks [@jycouet](https://github.com/jycouet)! - fix framework detection

-   [#964](https://github.com/HoudiniGraphql/houdini/pull/964) [`b223c60`](https://github.com/HoudiniGraphql/houdini/commit/b223c6079bb4a19d5708ad7daf905fe913dbec1e) Thanks [@jycouet](https://github.com/jycouet)! - update init script to stick to svelte & sveltekit defaults

## 1.0.7

### 🐛 Fixes

-   [#950](https://github.com/HoudiniGraphql/houdini/pull/950) [`52326b5`](https://github.com/HoudiniGraphql/houdini/commit/52326b5b54c1e722d398031e4b61281379cb8820) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - @include and @skip now add "undefined" to the generated TypeScript type

## 1.0.6

### 🦋 Feature/Fix

-   [#948](https://github.com/HoudiniGraphql/houdini/pull/948) [`8fd052c`](https://github.com/HoudiniGraphql/houdini/commit/8fd052c1d59fbb37e17da1bc42ae386a660440ed) Thanks @AlecAivazis! - Add id to the generated selections of inline fragments

## 1.0.5

### 🐛 Fixes

-   [#940](https://github.com/HoudiniGraphql/houdini/pull/940) [`f69f9f1`](https://github.com/HoudiniGraphql/houdini/commit/f69f9f1b12cf9bca5d0112db2e78c4d4e94b4845) Thanks @AlecAivazis! - Fix bug when relistening on a subscription

-   [#947](https://github.com/HoudiniGraphql/houdini/pull/947) [`92c533e`](https://github.com/HoudiniGraphql/houdini/commit/92c533e2ba0aae7ceaebe7407691ff36482a71f4) Thanks @AlecAivazis! - Fix behavior for CacheAndNetwork policies

## 1.0.4

### ✨ Features

-   [#937](https://github.com/HoudiniGraphql/houdini/pull/937) [`8e18042`](https://github.com/HoudiniGraphql/houdini/commit/8e1804227ee056f3b51c00f04832f4f997fdf1bc) Thanks @AlecAivazis! - Add cleanup method to DocumentStore

## 1.0.3

### 🐛 Fixes

-   [#933](https://github.com/HoudiniGraphql/houdini/pull/933) [`c9a6c86`](https://github.com/HoudiniGraphql/houdini/commit/c9a6c86ca8873f6fe52591b17aeeecc2e6a02014) Thanks @AlecAivazis! - Fix bug causing multiple websocket clients to be created

-   [#935](https://github.com/HoudiniGraphql/houdini/pull/935) [`64af71b`](https://github.com/HoudiniGraphql/houdini/commit/64af71b11bd5f07ff2d035a72d483bcf69834bf3) Thanks [@yaroslavros](https://github.com/yaroslavros)! - Fix issue when passing Cookie headers through cli

## 1.0.2

## 1.0.1

### ✨ Features

-   [#921](https://github.com/HoudiniGraphql/houdini/pull/921) [`0f8f7ba`](https://github.com/HoudiniGraphql/houdini/commit/0f8f7ba626caabe847e2a94d467fe965184c0afa) Thanks @AlecAivazis! - Improved type validation for fragment arguments

### 🐛 Fixes

-   [#921](https://github.com/HoudiniGraphql/houdini/pull/921) [`0f8f7ba`](https://github.com/HoudiniGraphql/houdini/commit/0f8f7ba626caabe847e2a94d467fe965184c0afa) Thanks @AlecAivazis! - Fix parsing logic for fragment argument types

## 1.0.0

For a better overview of the changes in this release, please visit the
[Release Notes](http://www.houdinigraphql.com/guides/release-notes).

### ⚠️ Breaking Changes

-   [#871](https://github.com/HoudiniGraphql/houdini/pull/871) [`fd7b46c`](https://github.com/HoudiniGraphql/houdini/commit/fd7b46c4ab5392e643a6e6bb243697147d13fd2b) Thanks @AlecAivazis! - Inline queries in routes with @load need a reactive marker

-   [#872](https://github.com/HoudiniGraphql/houdini/pull/872) [`de44252`](https://github.com/HoudiniGraphql/houdini/commit/de442526e7518cc575e8f00b94767fa3d45e6f91) Thanks @AlecAivazis! - Enums are generated as a constant object instead of a typescript enum. You can use the $options type for the union of all valid string values

-   [#858](https://github.com/HoudiniGraphql/houdini/pull/858) [`fad070f`](https://github.com/HoudiniGraphql/houdini/commit/fad070f04bd82acdcd71ecdaed52783f468b5216) Thanks @AlecAivazis! - Restructured codegen plugins

-   [#842](https://github.com/HoudiniGraphql/houdini/pull/842) [`d468143`](https://github.com/HoudiniGraphql/houdini/commit/d46814386d6ab8609aad01a10aeb028e6a829ecb) Thanks @AlecAivazis! - Grouped `apiUrl`, `schemaPollHeaders`, and `schemaPollInterval` together

-   [#841](https://github.com/HoudiniGraphql/houdini/pull/841) [`55e750c`](https://github.com/HoudiniGraphql/houdini/commit/55e750c8c90121ba021c597fa9c66364bc2dca8d) Thanks @AlecAivazis! - Restructure programmatic cache api

-   [#838](https://github.com/HoudiniGraphql/houdini/pull/838) [`d275adc`](https://github.com/HoudiniGraphql/houdini/commit/d275adc97dd97c49a8e35159d41e638128d8ad69) Thanks @AlecAivazis! - Implemented new ClientPlugin architecture for HoudiniClient

### ✨ Features

-   [#849](https://github.com/HoudiniGraphql/houdini/pull/849) [`c7d4008`](https://github.com/HoudiniGraphql/houdini/commit/c7d4008f67dd9e25cab4e3816d0459ad6ff7c436) Thanks [@jycouet](https://github.com/jycouet)! - Add support for marking data as stale

-   [#865](https://github.com/HoudiniGraphql/houdini/pull/865) [`3872a56`](https://github.com/HoudiniGraphql/houdini/commit/3872a5603b791e2530b3617bf61422e7444a483e) Thanks [@jycouet](https://github.com/jycouet)! - on schema change, revalidate all document. No need to restart vite to pick up changes.

### 🐛 Fixes

-   [#889](https://github.com/HoudiniGraphql/houdini/pull/889) [`fcba9f0`](https://github.com/HoudiniGraphql/houdini/commit/fcba9f0589ac6c066f95623d819cd9ea05d151a9) Thanks @AlecAivazis! - Fix out of memory error with nested recursive fragments

## 0.20.4

## 0.20.3

### 🐛 Fixes

-   [#836](https://github.com/HoudiniGraphql/houdini/pull/836) [`0f1f0b4`](https://github.com/HoudiniGraphql/houdini/commit/0f1f0b423f8c1e4f9126c183fa077bc4b4fd82e0) Thanks @AlecAivazis! - Fix syntax error when generating artifacts for queries that contain fragments with direct inline fragment children

## 0.20.2

### 🐛 Fixes

-   [#826](https://github.com/HoudiniGraphql/houdini/pull/826) [`815be2f`](https://github.com/HoudiniGraphql/houdini/commit/815be2f0650c503dadfa366616faef91d2462222) Thanks [@jycouet](https://github.com/jycouet)! - update init to have correct graphqlrc.yaml looking at svelte files

## 0.20.1

## 0.20.0

### ⚠️ Breaking Changes

-   [#800](https://github.com/HoudiniGraphql/houdini/pull/800) [`a107f6c`](https://github.com/HoudiniGraphql/houdini/commit/a107f6ce22f33719ed8c5fbeb49eb854d3238e9f) Thanks @AlecAivazis! - Rename `isFetching` to `fetching`

### 🐛 Fixes

-   [#801](https://github.com/HoudiniGraphql/houdini/pull/801) [`1d18dd4`](https://github.com/HoudiniGraphql/houdini/commit/1d18dd42c66933bbb67d2357a6cbb9023235cff9) Thanks @AlecAivazis! - Update init command to always write to vite.config.js

## 0.19.4

### 🐛 Fixes

-   [#796](https://github.com/HoudiniGraphql/houdini/pull/796) [`dae437e`](https://github.com/HoudiniGraphql/houdini/commit/dae437e3923628c0e816e7f53509c1ddcc8bd019) Thanks @AlecAivazis! - Remove logs from vite processor

## 0.19.3

### 🐛 Fixes

-   [#793](https://github.com/HoudiniGraphql/houdini/pull/793) [`d3ba00f`](https://github.com/HoudiniGraphql/houdini/commit/d3ba00f62d71d8cc7c2e89c8eb32a20370ecfe07) Thanks @AlecAivazis! - Fix erorr when using satisfies expression with load functions

## 0.19.2

## 0.19.1

### 🐛 Fixes

-   [#783](https://github.com/HoudiniGraphql/houdini/pull/783) [`2d6395b`](https://github.com/HoudiniGraphql/houdini/commit/2d6395ba3393ae9157f467d97ecda02a661ce4b9) Thanks @AlecAivazis! - Fix error in generated types for list operations

## 0.19.0

### ✨ Features

-   [#776](https://github.com/HoudiniGraphql/houdini/pull/776) [`8f70291`](https://github.com/HoudiniGraphql/houdini/commit/8f702919e9a496a3de8cb22e035d4525a354a5d1) Thanks @AlecAivazis! - graphql template tag can now be used as a function for automatic typing

-   [#779](https://github.com/HoudiniGraphql/houdini/pull/779) [`5739346`](https://github.com/HoudiniGraphql/houdini/commit/573934608c731a56fbdd7e0383fb6cb3be2faa4b) Thanks @AlecAivazis! - Add env hook to plugins

-   [#748](https://github.com/HoudiniGraphql/houdini/pull/748) [`78a18e8`](https://github.com/HoudiniGraphql/houdini/commit/78a18e8ff1b6e34baa4f30895091bd3da6a2fbba) Thanks @AlecAivazis! - Add experimental imperative api for cache

-   [#778](https://github.com/HoudiniGraphql/houdini/pull/778) [`9a09f31`](https://github.com/HoudiniGraphql/houdini/commit/9a09f31c6b6681213f4931a7c520471d87814d42) Thanks [@jycouet](https://github.com/jycouet)! - bump init script to follow latest kit init (without dedicated preprocessor)

## 0.18.3

### 🐛 Fixes

-   [#773](https://github.com/HoudiniGraphql/houdini/pull/773) [`57ea21c`](https://github.com/HoudiniGraphql/houdini/commit/57ea21c09707dbddfba5abf814f92c0d932ca628) Thanks [@jycouet](https://github.com/jycouet)! - Fix generated list operation fragments with custom keys

## 0.18.2

### ✨ Features

-   [#767](https://github.com/HoudiniGraphql/houdini/pull/767) [`0ed1a7b`](https://github.com/HoudiniGraphql/houdini/commit/0ed1a7bc29727615c99ea6f54beeef8660e14dc9) Thanks [@524c](https://github.com/524c)! - Add support for expr satisfies TS expressions

## 0.18.1

## 0.18.0

### ⚠️ Breaking Changes

-   [#754](https://github.com/HoudiniGraphql/houdini/pull/754) [`ca6b4ec`](https://github.com/HoudiniGraphql/houdini/commit/ca6b4ec1d9906cad9c624c05a8ab4e7487d23900) Thanks [@jycouet](https://github.com/jycouet)! - deprecated usage of parentID in append and prepend
    @houdini(load: false) was removed in favor of @manual_load
    @houdini(mask: true | false) -> @mask_enable / @mask_disable
    config disableMasking is now replaced by defaultFragmentMasking

### 🐛 Fixes

-   [#747](https://github.com/HoudiniGraphql/houdini/pull/747) [`7a34399`](https://github.com/HoudiniGraphql/houdini/commit/7a34399623d978f1ea89ec0a3fcf847893aa48fc) Thanks @AlecAivazis! - Fix issue when working with unions and interfaces

-   [#732](https://github.com/HoudiniGraphql/houdini/pull/732) [`138fddd`](https://github.com/HoudiniGraphql/houdini/commit/138fdddd8be9259e1e095c0077f7d8d498701aca) Thanks [@janvotava](https://github.com/janvotava)! - Do not delay app start by 2 schema pulls

### ✨ Features

-   [#738](https://github.com/HoudiniGraphql/houdini/pull/738) [`758683f`](https://github.com/HoudiniGraphql/houdini/commit/758683fdf5d28eaf995eae8acb3c03e231f91b56) Thanks [@jycouet](https://github.com/jycouet)! - apiUrl can now take environment variable

## 0.17.14

## 0.17.13

## 0.17.12

## 0.17.11

## 0.17.10

## 0.17.9

### 🐛 Fixes

-   [#693](https://github.com/HoudiniGraphql/houdini/pull/693) [`6e36775`](https://github.com/HoudiniGraphql/houdini/commit/6e367755d902eca3242519b4c609c0d5bc76f4ff) Thanks @AlecAivazis! - Fix bug causing `@parentID` to be ignored when there was only one version of the list

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

-   [#630](https://github.com/HoudiniGraphql/houdini/pull/630) [`02d8fc4`](https://github.com/HoudiniGraphql/houdini/commit/02d8fc47f71980bd2b6492162b8e57808447bdbc) Thanks @AlecAivazis! - Add shebang to executable

## 0.17.0

### ⚠️ Breaking Changes

-   [#593](https://github.com/HoudiniGraphql/houdini/pull/593) [`c1363fe`](https://github.com/HoudiniGraphql/houdini/commit/c1363fe938ab94281272cad8939b892fd705a803) Thanks @AlecAivazis! - Split houdini into two packages: `houdini` and `houdini-svelte`. For more information on migrating your project, please visit the [release notes](https://www.houdinigraphql.com/guides/release-notes).

### 🐛 Fixes

-   [#612](https://github.com/HoudiniGraphql/houdini/pull/612) [`6a0999f`](https://github.com/HoudiniGraphql/houdini/commit/6a0999ff0fd175a190e156c54b37c4a70e402dbc) Thanks @AlecAivazis! - Fix windows compatibility

## 0.16.8

### 🐛 Fixes

-   [#595](https://github.com/HoudiniGraphql/houdini/pull/595) [`3421404`](https://github.com/HoudiniGraphql/houdini/commit/3421404e58697bc8e066d3f0b2d9c74c77c0318a) Thanks @AlecAivazis! - Don't consider the schema path as an source for generation

-   [#594](https://github.com/HoudiniGraphql/houdini/pull/594) [`4ee9db3`](https://github.com/HoudiniGraphql/houdini/commit/4ee9db312c8ef9db3244bcd2f10f877d596e6f8d) Thanks @AlecAivazis! - Fixed bug preventing documents from being discovered on windows

## 0.16.7

### 🐛 Fixes

-   [#585](https://github.com/HoudiniGraphql/houdini/pull/585) [`29a8fcd`](https://github.com/HoudiniGraphql/houdini/commit/29a8fcd31da3d80d8fa4386010591ba051c0f6e9) Thanks [@jycouet](https://github.com/jycouet)! - fix - windows paths correctly import things now

### ✨ Features

-   [#584](https://github.com/HoudiniGraphql/houdini/pull/584) [`2b19fe5`](https://github.com/HoudiniGraphql/houdini/commit/2b19fe578bca749ca975787709cfcc8325dec68a) Thanks [@sjcobb2022](https://github.com/sjcobb2022)! - Added further config to vite plugin

-   [#559](https://github.com/HoudiniGraphql/houdini/pull/559) [`fd570de`](https://github.com/HoudiniGraphql/houdini/commit/fd570debffde942220bed024676574af8d4d5372) Thanks [@DanielHritcu](https://github.com/DanielHritcu)! - Config.include and exclude can now be arrays

## 0.16.6

### 🐛 Fixes

-   [#572](https://github.com/HoudiniGraphql/houdini/pull/572) [`7d1f8b0`](https://github.com/HoudiniGraphql/houdini/commit/7d1f8b0a96d7352bcebbbf3ece242dad2c402f36) Thanks @AlecAivazis! - Fix error causing subscriptions to be removed

-   [#572](https://github.com/HoudiniGraphql/houdini/pull/572) [`7d1f8b0`](https://github.com/HoudiniGraphql/houdini/commit/7d1f8b0a96d7352bcebbbf3ece242dad2c402f36) Thanks @AlecAivazis! - fix bug when importing store classes

### ✨ Features

-   [#563](https://github.com/HoudiniGraphql/houdini/pull/563) [`ad0ed5b`](https://github.com/HoudiniGraphql/houdini/commit/ad0ed5bcd476bb990ab08f351eed87bbf0cdd639) Thanks [@DanielHritcu](https://github.com/DanielHritcu)! - Warn user when the config file can't be read

*   [#569](https://github.com/HoudiniGraphql/houdini/pull/569) [`08f834a`](https://github.com/HoudiniGraphql/houdini/commit/08f834abff4637c023c9d7a208cd0c28976911b3) Thanks @AlecAivazis! - Mutation result is never null

-   [#566](https://github.com/HoudiniGraphql/houdini/pull/566) [`a86ec3b`](https://github.com/HoudiniGraphql/houdini/commit/a86ec3b8ae57faf1f0bffd7e10ea82fdeb3883cb) Thanks [@sjcobb2022](https://github.com/sjcobb2022)! - Extra config passed to plugin is used when pulling schema

-   [#569](https://github.com/HoudiniGraphql/houdini/pull/569) [`08f834a`](https://github.com/HoudiniGraphql/houdini/commit/08f834abff4637c023c9d7a208cd0c28976911b3) Thanks @AlecAivazis! - Subscription.listen arguments are optional

## 0.16.5

### 🐛 Fixes

-   [#557](https://github.com/HoudiniGraphql/houdini/pull/557) [`3690f4f`](https://github.com/HoudiniGraphql/houdini/commit/3690f4f081590e129e62b7499f6fa488fc067db1) Thanks @AlecAivazis! - Configured pull headers are included in pull-schema command

*   [#553](https://github.com/HoudiniGraphql/houdini/pull/553) [`7666734`](https://github.com/HoudiniGraphql/houdini/commit/7666734110350fb7886eeeeec95108b61f88ece8) Thanks @AlecAivazis! - fixed bug when loading offset-based pages driven by query variable

## 0.16.4

### 🐛 Fixes

-   [#548](https://github.com/HoudiniGraphql/houdini/pull/548) [`cd00b5f`](https://github.com/HoudiniGraphql/houdini/commit/cd00b5f436412ecc3ac2225d2ee8a9201b172da0) Thanks @AlecAivazis! - Fix bug when reading store value between load and render

## 0.16.3

### 🐛 Fixes

-   [#545](https://github.com/HoudiniGraphql/houdini/pull/545) [`6cc6765`](https://github.com/HoudiniGraphql/houdini/commit/6cc6765771f57a51711725f3bed458a2ab338278) Thanks @AlecAivazis! - fix a bug hiding +layout.server data from client

## 0.16.2

### ✨ Features

-   [#534](https://github.com/HoudiniGraphql/houdini/pull/534) [`599fc3c`](https://github.com/HoudiniGraphql/houdini/commit/599fc3c9dc7843c40ab25b4c4763e1b3ed9df6c7) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Add ability to control masking for a specific fragment

### 🐛 Fixes

-   [#540](https://github.com/HoudiniGraphql/houdini/pull/540) [`8addece`](https://github.com/HoudiniGraphql/houdini/commit/8addecef1063dfe7d48f539d1c9f6b72949d7fd2) Thanks [@jycouet](https://github.com/jycouet)! - Warn users when endpoint is not present in dev instead of crashing

*   [#542](https://github.com/HoudiniGraphql/houdini/pull/542) [`3697e33`](https://github.com/HoudiniGraphql/houdini/commit/3697e33ec644f87f13878b74413b507843d90325) Thanks @AlecAivazis! - Fix bug when loading queries in a layout file

-   [#539](https://github.com/HoudiniGraphql/houdini/pull/539) [`a7d4c2e`](https://github.com/HoudiniGraphql/houdini/commit/a7d4c2e9f650b86f8e19833079c286a64f807d2a) Thanks [@jycouet](https://github.com/jycouet)! - mono repo support

-   [#537](https://github.com/HoudiniGraphql/houdini/pull/537) [`191c775`](https://github.com/HoudiniGraphql/houdini/commit/191c7750a33b11cdbc8f5e7b9719641d5b0a21c5) Thanks [@jycouet](https://github.com/jycouet)! - init cmd, vite.config.ts generated file

## 0.16.1

### 🐛 Fixes

-   [#527](https://github.com/HoudiniGraphql/houdini/pull/527) [`9b87678`](https://github.com/HoudiniGraphql/houdini/commit/9b876789140978c0726ed9a708677c7c75f3e19b) Thanks @AlecAivazis! - Update init command to work with latest file template

## 0.16.0

### ⚠️ Breaking Changes

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - remove inline document functions query, paginatedQuery, subscription, and mutation

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - renamed `generate --pull-header` to `generate --header` and `generate --persist-output` to `generate --output`

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - added support for page queries

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - inverted argument order for inline fragments

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - Stores are now classes and need to be instantiated with `new MyQueryStore()`

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - query stores must now be passed to routes as props instead of globally imported

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - SvelteKit projects must now use houdini/vite as a vite plugin

-   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - `config.sourceGlob` has been renamed to `config.include` and is now optional. Also added `config.exclude` to filter out files matched by `config.include`

### ✨ Features

-   [#509](https://github.com/HoudiniGraphql/houdini/pull/509) [`4983a76`](https://github.com/HoudiniGraphql/houdini/commit/4983a76c46499acb98b73b3693c3e1f7da905ca9) Thanks [@jycouet](https://github.com/jycouet)! - warn users that inline functions no longer exist

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - You can now define the prefix of your global stores with globalStorePrefix param in the config.

*   [#508](https://github.com/HoudiniGraphql/houdini/pull/508) [`60ecb33`](https://github.com/HoudiniGraphql/houdini/commit/60ecb333a1396f9aa7244eac2f38741a58e7281f) Thanks [@fehnomenal](https://github.com/fehnomenal)! - added support for sessions

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - graphql tags return store references

*   [#449](https://github.com/HoudiniGraphql/houdini/pull/449) [`59257d1`](https://github.com/HoudiniGraphql/houdini/commit/59257d1dffa6c1d9d250ba0964c6f1f0c35da048) Thanks @AlecAivazis! - add generated typedefs for route functions

-   [#494](https://github.com/HoudiniGraphql/houdini/pull/494) [`5573cfa`](https://github.com/HoudiniGraphql/houdini/commit/5573cfa184d2da322030695044997f5fbf6542bd) Thanks @AlecAivazis! - add onError hook

-   [#494](https://github.com/HoudiniGraphql/houdini/pull/494) [`5573cfa`](https://github.com/HoudiniGraphql/houdini/commit/5573cfa184d2da322030695044997f5fbf6542bd) Thanks @AlecAivazis! - add `quietQueryError` config value to suppress all query errors

### 🐛 Fixes

-   [#485](https://github.com/HoudiniGraphql/houdini/pull/485) [`c21942c`](https://github.com/HoudiniGraphql/houdini/commit/c21942c4a364dbaca4008dc0ad8263fdc940da84) Thanks [@jycouet](https://github.com/jycouet)! - fix peerDependencies of houdini, graphql needs to be <16

-   [#523](https://github.com/HoudiniGraphql/houdini/pull/523) [`2c5174c`](https://github.com/HoudiniGraphql/houdini/commit/2c5174c248bf2ae5ee3a8d3a7e910213e859ae2a) Thanks @AlecAivazis! - fix circular import with HoudiniClient

-   [#490](https://github.com/HoudiniGraphql/houdini/pull/490) [`71caba7`](https://github.com/HoudiniGraphql/houdini/commit/71caba7c6b23e73754934fd604030f3cd1a9b74b) Thanks @AlecAivazis! - fix generated types for optimistic responses

-   [#487](https://github.com/HoudiniGraphql/houdini/pull/487) [`0544a28`](https://github.com/HoudiniGraphql/houdini/commit/0544a2846125673f2f0e67cb02135554458edfb0) Thanks @AlecAivazis! - Fix issues when rendering kit applications with framework set to "svelte"

## 0.15.9

### Patch Changes

-   [#443](https://github.com/HoudiniGraphql/houdini/pull/443) [`801d7e8`](https://github.com/HoudiniGraphql/houdini/commit/801d7e87f5199cb5e352001826d8f2d4c454bcc3) Thanks [@jycouet](https://github.com/jycouet)! - warn user when Node interface is not properly defined and throw an error on Node usage (when not properly defined)

## 0.15.8

### Patch Changes

-   [#434](https://github.com/HoudiniGraphql/houdini/pull/434) [`ebeb90e`](https://github.com/HoudiniGraphql/houdini/commit/ebeb90e1a9528b1b327bc161d26dc962ba7812bd) Thanks @AlecAivazis! - prevent store information from leaking across requests boundaries

*   [#434](https://github.com/HoudiniGraphql/houdini/pull/434) [`ebeb90e`](https://github.com/HoudiniGraphql/houdini/commit/ebeb90e1a9528b1b327bc161d26dc962ba7812bd) Thanks @AlecAivazis! - updated type definition for config file to allow for missing marshal/unmarshal functions

## 0.15.7

### Patch Changes

-   [#429](https://github.com/HoudiniGraphql/houdini/pull/429) [`d6d5c50`](https://github.com/HoudiniGraphql/houdini/commit/d6d5c50c2f4f0365a5939799fbcab4205fd99317) Thanks [@jycouet](https://github.com/jycouet)! - fix: unsub only when you have no active stores

## 0.15.6

### Patch Changes

-   [#426](https://github.com/HoudiniGraphql/houdini/pull/426) [`73b2467`](https://github.com/HoudiniGraphql/houdini/commit/73b2467e20f68b37ed0d3bb47f823361d685d026) Thanks @AlecAivazis! - fixed bug when generating list operation types without masking

*   [#426](https://github.com/HoudiniGraphql/houdini/pull/426) [`73b2467`](https://github.com/HoudiniGraphql/houdini/commit/73b2467e20f68b37ed0d3bb47f823361d685d026) Thanks @AlecAivazis! - subscription.listen is a no-op on the server

-   [#423](https://github.com/HoudiniGraphql/houdini/pull/423) [`ff44c42`](https://github.com/HoudiniGraphql/houdini/commit/ff44c42220dbc50ca6e23a7a2e40a93bb32f7a24) Thanks @AlecAivazis! - fix bug when computing variables in component queries

*   [#419](https://github.com/HoudiniGraphql/houdini/pull/419) [`6363707`](https://github.com/HoudiniGraphql/houdini/commit/6363707d1a9471d9b8b62e8206d2660c316d9d05) Thanks [@jycouet](https://github.com/jycouet)! - feat: in summary a new log is displayed about what item was deleted

-   [#397](https://github.com/HoudiniGraphql/houdini/pull/397) [`ed764a2`](https://github.com/HoudiniGraphql/houdini/commit/ed764a235c81442babd9c153960d0ef5452f379c) Thanks @AlecAivazis! - update init script to detect tooling automatically

*   [#394](https://github.com/HoudiniGraphql/houdini/pull/394) [`96468da`](https://github.com/HoudiniGraphql/houdini/commit/96468dab8499085b9332044736b7c1b497d3fa58) Thanks [@david-plugge](https://github.com/david-plugge)! - export preprocessor types

-   [#392](https://github.com/HoudiniGraphql/houdini/pull/392) [`17e50a9`](https://github.com/HoudiniGraphql/houdini/commit/17e50a925188c499dc865fc2d16bc248713d5c90) Thanks @AlecAivazis! - Add variable store to inline query result

*   [#413](https://github.com/HoudiniGraphql/houdini/pull/413) [`8be5953`](https://github.com/HoudiniGraphql/houdini/commit/8be5953ae4237ef0f84346c595446ba8cd3feaee) Thanks [@jycouet](https://github.com/jycouet)! - improve: checking if you wrote an operation in a module, and warn you if it's the case

-   [#409](https://github.com/HoudiniGraphql/houdini/pull/409) [`6f99e1f`](https://github.com/HoudiniGraphql/houdini/commit/6f99e1fd826c8476f62644a3991380c805272c7f) Thanks @AlecAivazis! - improved preprocessor performance

*   [#405](https://github.com/HoudiniGraphql/houdini/pull/405) [`7eb7d39`](https://github.com/HoudiniGraphql/houdini/commit/7eb7d398174c796f6525de47aef08161e8b28ef3) Thanks @AlecAivazis! - Add support for query stores in endpoints

-   [#403](https://github.com/HoudiniGraphql/houdini/pull/403) [`97ea10d`](https://github.com/HoudiniGraphql/houdini/commit/97ea10dc8eeb81eff437fd51d4d1eceece7376a9) Thanks @AlecAivazis! - fix error when prerendering queries

*   [#416](https://github.com/HoudiniGraphql/houdini/pull/416) [`3f56c0d`](https://github.com/HoudiniGraphql/houdini/commit/3f56c0d6bf69690b617ce8d56c607acc5b6448b7) Thanks [@jycouet](https://github.com/jycouet)! - avoid clearing store state when there are all multiple subscribers

-   [#419](https://github.com/HoudiniGraphql/houdini/pull/419) [`6363707`](https://github.com/HoudiniGraphql/houdini/commit/6363707d1a9471d9b8b62e8206d2660c316d9d05) Thanks [@jycouet](https://github.com/jycouet)! - improve: generate will write files only if it has changed

## 0.15.5

### Patch Changes

-   [#377](https://github.com/HoudiniGraphql/houdini/pull/377) [`9836c94`](https://github.com/HoudiniGraphql/houdini/commit/9836c94f36a0cba387a86ef31075cf318a5df557) Thanks [@jycouet](https://github.com/jycouet)! - avoid manipulating scalars with null values

*   [#384](https://github.com/HoudiniGraphql/houdini/pull/384) [`0c567cd`](https://github.com/HoudiniGraphql/houdini/commit/0c567cd3c4c9eb44f63e54712582e15837472773) Thanks @AlecAivazis! - fix bug with incorrect page info type

## 0.15.4

### Patch Changes

-   [#378](https://github.com/HoudiniGraphql/houdini/pull/378) [`6e71762`](https://github.com/HoudiniGraphql/houdini/commit/6e717629e0059cead070a92db9a6b81c91a163d2) Thanks @AlecAivazis! - always treat layout files as routes

## 0.15.3

### Patch Changes

-   [#375](https://github.com/HoudiniGraphql/houdini/pull/375) [`918ff87`](https://github.com/HoudiniGraphql/houdini/commit/918ff87b9a7f5ff1068327c36088df1c89df6341) Thanks [@jycouet](https://github.com/jycouet)! - fix issue with embedded page info in paginated query stores

## 0.15.2

### Patch Changes

-   [#370](https://github.com/HoudiniGraphql/houdini/pull/370) [`1ce03ec`](https://github.com/HoudiniGraphql/houdini/commit/1ce03ece112bf2688dcc066bdd844fa8b431fe4a) Thanks @AlecAivazis! - fixed bug when generating type definitions for interfaces mixed on interfaces

## 0.15.1

### Patch Changes

-   [#366](https://github.com/HoudiniGraphql/houdini/pull/366) [`5a1e7e0`](https://github.com/HoudiniGraphql/houdini/commit/5a1e7e07e0e2cf8734dae3af1a95b93600328734) Thanks @AlecAivazis! - improved logic for distinguishing routes from components in a SvelteKit project

*   [#367](https://github.com/HoudiniGraphql/houdini/pull/367) [`66d0bcf`](https://github.com/HoudiniGraphql/houdini/commit/66d0bcfb1d0f70dae966540a8858aed285c15e0e) Thanks @AlecAivazis! - Add a `configFile` parameter to the preprocessor so users can specify where to find their `houdini.config.js` file

-   [#364](https://github.com/HoudiniGraphql/houdini/pull/364) [`b323f54`](https://github.com/HoudiniGraphql/houdini/commit/b323f5411db92f669edef64eed0df59bb0233ae8) Thanks @AlecAivazis! - Add enum definitions to generated runtime

## 0.15.0

Version 0.15.0 is the biggest release yet! Thanks for everyone who helped test/contribute :tada: 🥰 The biggest update here is that documents now have a brand new store-based API. For more information on what's changed and how to update your project, check out this link: https://www.houdinigraphql.com/guides/migrating-to-0.15.0

### Breaking Changes

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@AlecAivazis][@jycouet](https://github.com/jycouet)! - definitionsPath refers now to a folder path that will contain schema and documents

*   [#315](https://github.com/HoudiniGraphql/houdini/pull/315) [`4cf4b7f`](https://github.com/HoudiniGraphql/houdini/commit/4cf4b7f93d893ede734c7a067f03b14499cc9773) Thanks @AlecAivazis! - parentID directive and arguments are now relative to object containing the decorated field

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks [@jycouet](https://github.com/jycouet)! - Default framework is now kit, default module type is esm

*   [#291](https://github.com/HoudiniGraphql/houdini/pull/291) [`17cd57e`](https://github.com/HoudiniGraphql/houdini/commit/17cd57eac72596823d2a4dddec85b6ac1a1d09dd) Thanks [@jycouet](https://github.com/jycouet) and [@AlecAivazis](https://github.com/AlecAivazis)! - Added store-based APIs :tada:

### Fixes/Updates

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks @AlecAivazis! - Missing scalars generate as any and produce a console warning instead of an error

-   [#331](https://github.com/HoudiniGraphql/houdini/pull/331) [`41cd95a`](https://github.com/HoudiniGraphql/houdini/commit/41cd95a577e418b6937039da963f82c95bd79854) Thanks @AlecAivazis! - Fixed return type of inline mutation

*   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks @AlecAivazis! - Add `disableMasking` config value to disable fragment masking

-   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks @AlecAivazis! - initial value for inline fragment can be null

*   [#344](https://github.com/HoudiniGraphql/houdini/pull/344) [`ca0709d`](https://github.com/HoudiniGraphql/houdini/commit/ca0709dfb7d66e77556f3d8334a428f1ac148aef) Thanks @AlecAivazis! - Added support for non-string cursors

-   [#341](https://github.com/HoudiniGraphql/houdini/pull/341) [`a0b6030`](https://github.com/HoudiniGraphql/houdini/commit/a0b6030324816765b6c5cf451dd09586fbd886ec) Thanks @AlecAivazis! - allow null values passed to fragment

*   [#321](https://github.com/HoudiniGraphql/houdini/pull/321) [`47bb94e`](https://github.com/HoudiniGraphql/houdini/commit/47bb94ea4b6c36210f1d2b7812613287fbe82e61) Thanks @AlecAivazis! - config.schemaPath can be a glob pointing to multiple files

## 0.14.8

### Patch Changes

-   [#310](https://github.com/HoudiniGraphql/houdini/pull/310) [`5cba9e2`](https://github.com/HoudiniGraphql/houdini/commit/5cba9e25a314fc6378e48a3114a91cc1fb8d7557) Thanks [@alexlafroscia](https://github.com/alexlafroscia)! - scrub variables only used by internal directives from query

## 0.14.7

### Patch Changes

-   [#306](https://github.com/HoudiniGraphql/houdini/pull/306) [`fe79ff3`](https://github.com/HoudiniGraphql/houdini/commit/fe79ff337aa922d19fdb6f36182fa365c85a2093) Thanks @AlecAivazis! - Fixed bug when loading data inserted with mutation

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

-   [#283](https://github.com/HoudiniGraphql/houdini/pull/283) [`dd20142`](https://github.com/HoudiniGraphql/houdini/commit/dd201422f0359f44cf18b338ed4ecd0d13799149) Thanks @AlecAivazis! - Fixed bug in component queries associated with the unloaded response from `load`.

## 0.14.2

### Patch Changes

-   [#277](https://github.com/HoudiniGraphql/houdini/pull/277) [`d010c3f`](https://github.com/HoudiniGraphql/houdini/commit/d010c3f8b5b4005a6ca02e748724079134fcebbd) Thanks @AlecAivazis! - List operations no longer throw an exception if the list isn't found as well as a few improvements to the list caching strategy

*   [#279](https://github.com/HoudiniGraphql/houdini/pull/279) [`de1ae3b`](https://github.com/HoudiniGraphql/houdini/commit/de1ae3be60f04971c1b9c8bca9a89973438a1965) Thanks [@oplik0](https://github.com/oplik0)! - add pinst to disable postinstall for publishing

## 0.14.1

### Patch Changes

-   [#275](https://github.com/HoudiniGraphql/houdini/pull/275) [`baf233b`](https://github.com/HoudiniGraphql/houdini/commit/baf233b10f447006386ef0b2de1a3a53edecf6c0) Thanks @AlecAivazis! - Fixed edge cases involving adding, removing, and deleting records back to back from in-memory cache"

## 0.14.0

### Breaking Changes

-   [#273](https://github.com/HoudiniGraphql/houdini/pull/273) [`2adabd7`](https://github.com/HoudiniGraphql/houdini/commit/2adabd7c78b89f12cd556a241245899b13cde30f) Thanks @AlecAivazis! - Consolidated all houdini packages under a single import. The preprocessor should now be imported from `houdini/preprocess`.

### Patch Changes

-   [#263](https://github.com/HoudiniGraphql/houdini/pull/263) [`c5cce52`](https://github.com/HoudiniGraphql/houdini/commit/c5cce5217149bc1b2be1f48cb734fb451b03a28f) Thanks @AlecAivazis! - Added support for non-standard IDs and paginated fragment queries

## 0.13.10

### Patch Changes

-   [#269](https://github.com/HoudiniGraphql/houdini/pull/269) [`bfcd003`](https://github.com/HoudiniGraphql/houdini/commit/bfcd00357e92b47caec988baa919c5c84ddcc333) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Execute multiple queries in parallel

## 0.13.9

### Patch Changes

-   [#266](https://github.com/HoudiniGraphql/houdini/pull/266) [`b26cb5e`](https://github.com/HoudiniGraphql/houdini/commit/b26cb5e032ffb87c40b3c43cef73c211cf2fd3de) Thanks [@fehnomenal](https://github.com/fehnomenal)! - Fix `afterLoad` data

## 0.13.8

### Patch Changes

-   [#259](https://github.com/HoudiniGraphql/houdini/pull/259) [`d49c30a`](https://github.com/HoudiniGraphql/houdini/commit/d49c30a844228a6004f4590fd74355691f17095e) Thanks @AlecAivazis! - fixes an issue when resolving the first layer in the cache
