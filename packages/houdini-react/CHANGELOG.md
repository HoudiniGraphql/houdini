# houdini-react

## 2.0.0-next.46

### Patch Changes

- [#1696](https://github.com/HoudiniGraphql/houdini/pull/1696) [`d3137c4`](https://github.com/HoudiniGraphql/houdini/commit/d3137c4d823c93d48fbc16d28d0a0852fb281c6c) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - A paginated fragment spread on an `@loading` query no longer fires a `node(id: PendingValue)` request while its parent is still loading. The pagination handlers no-op until the parent entity resolves, so the fragment works without an `if (!loading)` guard.

- [#1696](https://github.com/HoudiniGraphql/houdini/pull/1696) [`d3137c4`](https://github.com/HoudiniGraphql/houdini/commit/d3137c4d823c93d48fbc16d28d0a0852fb281c6c) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix React `@loading` pages failing to hydrate on the client, which left them non-interactive and prevented paginated fragments spread on an `@loading` query from rendering or paginating once the data resolved.

## 2.0.0-next.45

### Minor Changes

- [#1692](https://github.com/HoudiniGraphql/houdini/pull/1692) [`0f4ae4a`](https://github.com/HoudiniGraphql/houdini/commit/0f4ae4ab652e292f798fd181e577fd1bfb250343) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add the `@refetchable` directive to mark a fragment as refetchable on its own with new argument values.

- [#1693](https://github.com/HoudiniGraphql/houdini/pull/1693) [`7ffe142`](https://github.com/HoudiniGraphql/houdini/commit/7ffe1420c60c775a897ccb75618f23d6a25cf660) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Remove the `useCurrentVariables` hook. Route variables are available through `useRoute().params`.

- [#1691](https://github.com/HoudiniGraphql/houdini/pull/1691) [`257e195`](https://github.com/HoudiniGraphql/houdini/commit/257e195565013c25367c727fd44c2c73c289e791) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add search param integration into queries, Link, and goto, with custom scalars marshaled into the URL and unmarshaled on read. Route params and search are now read through useRoute() (typed per route via the generated PageRoute type), replacing useLocation.

### Patch Changes

- Updated dependencies [[`0f4ae4a`](https://github.com/HoudiniGraphql/houdini/commit/0f4ae4ab652e292f798fd181e577fd1bfb250343), [`257e195`](https://github.com/HoudiniGraphql/houdini/commit/257e195565013c25367c727fd44c2c73c289e791)]:
  - houdini@2.0.0-next.45

## 2.0.0-next.44

### Minor Changes

- [#1690](https://github.com/HoudiniGraphql/houdini/pull/1690) [`981a38f`](https://github.com/HoudiniGraphql/houdini/commit/981a38f7302c7f40c40a2a3afa2630f8577a100b) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add the `@plural` fragment directive for spreading a fragment on a list field and reading it back as an array of data through `useFragment` (React) or `fragment` (Svelte).

### Patch Changes

- Updated dependencies [[`981a38f`](https://github.com/HoudiniGraphql/houdini/commit/981a38f7302c7f40c40a2a3afa2630f8577a100b), [`f1ae542`](https://github.com/HoudiniGraphql/houdini/commit/f1ae542be6e094b4e39b1b181176c00d4eac1956), [`de10b1f`](https://github.com/HoudiniGraphql/houdini/commit/de10b1f824c3ada960254968a455b963a1d8ad2f)]:
  - houdini@2.0.0-next.44

## 2.0.0-next.43

### Minor Changes

- [#1685](https://github.com/HoudiniGraphql/houdini/pull/1685) [`cc47a1a`](https://github.com/HoudiniGraphql/houdini/commit/cc47a1ad7fbc1d8d7e7effc0d8935af80054e707) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Pages and layouts can now export a `headers()` function to set HTTP response headers for a route. Headers from the page and its layout chain are merged before streaming, with the page taking precedence over its layouts.

### Patch Changes

- Updated dependencies [[`cc47a1a`](https://github.com/HoudiniGraphql/houdini/commit/cc47a1ad7fbc1d8d7e7effc0d8935af80054e707)]:
  - houdini@2.0.0-next.43

## 2.0.0-next.42

### Minor Changes

- [#1677](https://github.com/HoudiniGraphql/houdini/pull/1677) [`ef5363e`](https://github.com/HoudiniGraphql/houdini/commit/ef5363ed9927cf52a97932dffa3eba983af6a8e9) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - add `createMock` for first-class testing support — returns a fully composed React component for any route, wired with a fresh cache and mock network client.

### Patch Changes

- Updated dependencies [[`ef5363e`](https://github.com/HoudiniGraphql/houdini/commit/ef5363ed9927cf52a97932dffa3eba983af6a8e9), [`ef5363e`](https://github.com/HoudiniGraphql/houdini/commit/ef5363ed9927cf52a97932dffa3eba983af6a8e9)]:
  - houdini@2.0.0-next.42

## 2.0.0-next.41

### Patch Changes

- [#1671](https://github.com/HoudiniGraphql/houdini/pull/1671) [`f064d16`](https://github.com/HoudiniGraphql/houdini/commit/f064d165dcd38888ddb65bed065bb0ab3685c691) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fixed a flash of intermediate data during single-page fragment pagination and unnecessary network requests on backward navigation by suppressing partial cache hits and preserving marshaled variables across consecutive sends.

## 2.0.0-next.40

### Minor Changes

- [#1666](https://github.com/HoudiniGraphql/houdini/pull/1666) [`cb689af`](https://github.com/HoudiniGraphql/houdini/commit/cb689af828ef44ac3109dcfbcfda61a57b64fca8) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add `+error.tsx` route-level error boundaries and a full routing error toolkit (`notFound()`, `redirect()`, `unauthorized()`, `forbidden()`, `httpError()`, `isRoutingError`, `isApiError`) for the React adapter.

## 2.0.0-next.39

### Patch Changes

- [#1664](https://github.com/HoudiniGraphql/houdini/pull/1664) [`4ea90cb`](https://github.com/HoudiniGraphql/houdini/commit/4ea90cbc458899ecc5c262d7f80f2d013d7a0a1e) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fixed fragment pagination

## 2.0.0-next.38

### Patch Changes

- [`892411c`](https://github.com/HoudiniGraphql/houdini/commit/892411c2938c93265583fbea9dca25cb4af1d9c1) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix preload conflicting with navigations

## 2.0.0-next.37

### Minor Changes

- [#1655](https://github.com/HoudiniGraphql/houdini/pull/1655) [`2c796b8`](https://github.com/HoudiniGraphql/houdini/commit/2c796b82878d96da1d38e90b6eb46e1639c2c9f3) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add a `<Link>` component with a typed `to` prop checked at compile time against your app's route manifest, with `params` interpolation and custom scalar support.

## 2.0.0-next.36

### Patch Changes

- [#1654](https://github.com/HoudiniGraphql/houdini/pull/1654) [`6d40af6`](https://github.com/HoudiniGraphql/houdini/commit/6d40af6dac5490ff7046fef5fd48cb15941bfcd1) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - GraphQL errors now expose `locations`, `path`, and `extensions` per the spec; augment `App.GraphQLErrorExtensions` to type your server's extensions.

- [#1650](https://github.com/HoudiniGraphql/houdini/pull/1650) [`03aba94`](https://github.com/HoudiniGraphql/houdini/commit/03aba94e0b473ed4aedd1f16ddb96d2cd64c0549) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix `useMutation` to return `[mutate, pending]` instead of `[pending, mutate]`, and fix list toggle operations accumulating across resolved optimistic mutation layers causing subsequent toggles to appear stuck.

- Updated dependencies [[`6d40af6`](https://github.com/HoudiniGraphql/houdini/commit/6d40af6dac5490ff7046fef5fd48cb15941bfcd1), [`3b5e7d6`](https://github.com/HoudiniGraphql/houdini/commit/3b5e7d661503b2102c0af20a7029102646ca2aa6), [`8bd7291`](https://github.com/HoudiniGraphql/houdini/commit/8bd72911a7a022ccb68e7c3b5047f144077c3e4c), [`03aba94`](https://github.com/HoudiniGraphql/houdini/commit/03aba94e0b473ed4aedd1f16ddb96d2cd64c0549), [`961a019`](https://github.com/HoudiniGraphql/houdini/commit/961a019e2ca2c9f202ec340e17e07eb6143966c0), [`b8b757a`](https://github.com/HoudiniGraphql/houdini/commit/b8b757a8c0b5c1db67a65af33cf9c684efab04a5), [`bf966b9`](https://github.com/HoudiniGraphql/houdini/commit/bf966b9eaf35166628bb6b3ed0f35b8a42700b6c), [`8f4a044`](https://github.com/HoudiniGraphql/houdini/commit/8f4a044487b9e042cc6dd162430ff6bdf741e0aa)]:
  - houdini@2.0.0-next.34

## 2.0.0-next.35

### Patch Changes

- [`fec6727`](https://github.com/HoudiniGraphql/houdini/commit/fec672700d142c0e300da0529f7404b3e8521a09) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - prevent unnecessary re-renders on fragments by stabilizing returned values and skipping subscription updates when data hasn't changed

- [`fec6727`](https://github.com/HoudiniGraphql/houdini/commit/fec672700d142c0e300da0529f7404b3e8521a09) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix gaps in pagination request deduplication: stale inflight entries no longer block new requests, and ssr_signals now covers client-side concurrent renders to prevent duplicate observer/send pairs

## 2.0.0-next.34

### Patch Changes

- [`7e775ca`](https://github.com/HoudiniGraphql/houdini/commit/7e775ca4aa532e69559d19ae38403f964463c6ae) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - write generated files atomically to prevent partial-read parse errors when Vite loads a module mid-pipeline

- [`7e775ca`](https://github.com/HoudiniGraphql/houdini/commit/7e775ca4aa532e69559d19ae38403f964463c6ae) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix HMR not regenerating the router manifest when a new `+page` or `+layout` file is added; invalidate component fields cache after each HMR cycle

## 2.0.0-next.33

### Patch Changes

- [#1638](https://github.com/HoudiniGraphql/houdini/pull/1638) [`d3856da`](https://github.com/HoudiniGraphql/houdini/commit/d3856daaae60cd73f4daae83e809a103ff14c5f2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix FOUC in dev mode by collecting CSS from the Vite module graph and passing them as React 19 stylesheet links that get hoisted to <head> during SSR

- [#1638](https://github.com/HoudiniGraphql/houdini/pull/1638) [`d3856da`](https://github.com/HoudiniGraphql/houdini/commit/d3856daaae60cd73f4daae83e809a103ff14c5f2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix TS2304 error in generated useFragmentHandle.ts by importing DocumentHandle type from useDocumentHandle

- [#1638](https://github.com/HoudiniGraphql/houdini/pull/1638) [`d3856da`](https://github.com/HoudiniGraphql/houdini/commit/d3856daaae60cd73f4daae83e809a103ff14c5f2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix TS2554 in generated injectedPlugins.ts by omitting arguments when a client plugin's config is null

- [#1638](https://github.com/HoudiniGraphql/houdini/pull/1638) [`d3856da`](https://github.com/HoudiniGraphql/houdini/commit/d3856daaae60cd73f4daae83e809a103ff14c5f2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix SSR middleware intercepting Vite module requests and missing Content-Type header; fix FOUC by enforcing correct CSS link precedence and deduplicating links; silence pre-warm noise by checking file existence before ssrLoadModule; set HOUDINI_PORT on server listen

## 2.0.0-next.32

### Patch Changes

- [`bb2944a`](https://github.com/HoudiniGraphql/houdini/commit/bb2944a76c8c65efdb5cac76bc7ff838cb34ceec) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix plugin resolution when npm normalizes bin field to object form

## 2.0.0-next.31

### Patch Changes

- [`a095fcc`](https://github.com/HoudiniGraphql/houdini/commit/a095fcc4eb51d6863a9cabc04b145fa96a53f240) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - publish wasm packages

## 2.0.0-next.30

### Patch Changes

- [#1631](https://github.com/HoudiniGraphql/houdini/pull/1631) [`86cecd1`](https://github.com/HoudiniGraphql/houdini/commit/86cecd19a8f54662624913400a6d82192639901b) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Bump dependencies to latest: express ^5, graphql-yoga ^5, @whatwg-node/server ^0.11, react ^19.2.7

- [#1630](https://github.com/HoudiniGraphql/houdini/pull/1630) [`43d89e0`](https://github.com/HoudiniGraphql/houdini/commit/43d89e0a70b0daf8748ca9225a92b0b2b6bffa7a) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Added WebContainer compatible database layer

## 2.0.0-next.29

### Patch Changes

- Updated dependencies [[`5668b992`](https://github.com/HoudiniGraphql/houdini/commit/5668b9927ace9b9574faf396d1a559b3b5ccf769)]:
  - houdini@2.0.0-next.28

## 2.0.0-next.28

### Patch Changes

- Updated dependencies []:
  - houdini@2.0.0-next.27

## 2.0.0-next.27

### Patch Changes

- Updated dependencies [[`899054d5`](https://github.com/HoudiniGraphql/houdini/commit/899054d5d0ec1416dc0e4a3d8bd745093b951642)]:
  - houdini@2.0.0-next.26

## 2.0.0-next.26

### Patch Changes

- [`03e91242`](https://github.com/HoudiniGraphql/houdini/commit/03e912421b88610e9686b600f8e25d0c320ffa37) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - create is more flexible

## 2.0.0-next.25

### Patch Changes

- [`dd9d1cbf`](https://github.com/HoudiniGraphql/houdini/commit/dd9d1cbf499b8b6f327c8d457edc3b04176d55a4) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix bug caused crashes during hydration

- [`e929d0d2`](https://github.com/HoudiniGraphql/houdini/commit/e929d0d2325fd33d9128bcdfce21fbc47d16066e) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix refresh collapse

- Updated dependencies [[`dd9d1cbf`](https://github.com/HoudiniGraphql/houdini/commit/dd9d1cbf499b8b6f327c8d457edc3b04176d55a4)]:
  - houdini@2.0.0-next.25

## 2.0.0-next.24

### Patch Changes

- [`a67c5fc6`](https://github.com/HoudiniGraphql/houdini/commit/a67c5fc671b0e53e77217fa9b43dfe53ec2bb0f6) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add missing extensions in modules

- Updated dependencies [[`a67c5fc6`](https://github.com/HoudiniGraphql/houdini/commit/a67c5fc671b0e53e77217fa9b43dfe53ec2bb0f6)]:
  - houdini@2.0.0-next.24

## 2.0.0-next.23

### Patch Changes

- [#1615](https://github.com/HoudiniGraphql/houdini/pull/1615) [`86124847`](https://github.com/HoudiniGraphql/houdini/commit/861248477429683de8f329bcb2a4da075b9d6122) Thanks [@github-actions](https://github.com/apps/github-actions)! - Fix package.json included in generated runtime

- Updated dependencies []:
  - houdini@2.0.0-next.23

## 2.0.0-next.22

### Minor Changes

- [`ef91e5c1`](https://github.com/HoudiniGraphql/houdini/commit/ef91e5c1d00526fea772d3eae5661a8617fd79ce) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Add scalar module imports, align DocumentHandle with fetching and errors fields

### Patch Changes

- Updated dependencies [[`ef91e5c1`](https://github.com/HoudiniGraphql/houdini/commit/ef91e5c1d00526fea772d3eae5661a8617fd79ce)]:
  - houdini@2.0.0-next.22

## 2.0.0-go.21

### Patch Changes

- Updated dependencies [[`14fa602a`](https://github.com/HoudiniGraphql/houdini/commit/14fa602a4aaeee3f0863e7f0c93945f0eebac51e), [`cd3fa07a`](https://github.com/HoudiniGraphql/houdini/commit/cd3fa07a6405de85f08954faa84895296f032ef4)]:
  - houdini@2.0.0-go.21

## 2.0.0-go.20

### Minor Changes

- [#1609](https://github.com/HoudiniGraphql/houdini/pull/1609) [`bac3a2b5`](https://github.com/HoudiniGraphql/houdini/commit/bac3a2b554f6d990adb6ae6314d524977d7771b5) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Converted react plugin to new go compiler

### Patch Changes

- Updated dependencies [[`d1848162`](https://github.com/HoudiniGraphql/houdini/commit/d18481625a443cd41f72d605b0999a0ca75c9555)]:
  - houdini@2.0.0-go.20

## 2.0.0-go.19

### Minor Changes

- [#1599](https://github.com/HoudiniGraphql/houdini/pull/1599) [`d4472272`](https://github.com/HoudiniGraphql/houdini/commit/d44722725c5e2302e041e3360020e386e098730f) Thanks [@SeppahBaws](https://github.com/SeppahBaws)! - Bump Vite version

### Patch Changes

- Updated dependencies [[`d4472272`](https://github.com/HoudiniGraphql/houdini/commit/d44722725c5e2302e041e3360020e386e098730f)]:
  - houdini@2.0.0-go.19

## 2.0.0-go.18

### Patch Changes

- Updated dependencies [[`86ed9d27`](https://github.com/HoudiniGraphql/houdini/commit/86ed9d279d11443df553e9d1d42ab930ba878393)]:
  - houdini@2.0.0-go.18

## 2.0.0-go.17

### Major Changes

- [#1593](https://github.com/HoudiniGraphql/houdini/pull/1593) [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Rewrote entire codegen pipeline in golang

### Minor Changes

- [#1593](https://github.com/HoudiniGraphql/houdini/pull/1593) [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - add abortController to query and mutation args

- [#1593](https://github.com/HoudiniGraphql/houdini/pull/1593) [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - move graphql to peerDependencies with >=16 range, automatically compatible with v17 when it releases

### Patch Changes

- [#1593](https://github.com/HoudiniGraphql/houdini/pull/1593) [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - throw RuntimeGraphQLError from useMutation when response contains errors

- Updated dependencies [[`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480), [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480), [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480), [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480), [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480), [`8bd407b4`](https://github.com/HoudiniGraphql/houdini/commit/8bd407b430687543944da269814344e01d2e8480)]:
  - houdini@2.0.0-go.17

## 2.0.0-go.16

### Patch Changes

- Updated dependencies []:
  - houdini@2.0.0-go.16

## 2.0.0-go.15

### Patch Changes

- Updated dependencies []:
  - houdini@2.0.0-go.15

## 2.0.0-go.14

### Patch Changes

- Updated dependencies [[`0610efa9`](https://github.com/HoudiniGraphql/houdini/commit/0610efa92e09344216bb1be1cf5610dbba3d570f), [`89252315`](https://github.com/HoudiniGraphql/houdini/commit/8925231525061d0fba35a6b78df5cfd2cde74920)]:
  - houdini@2.0.0-go.14

## 2.0.0-go.13

### Patch Changes

- Updated dependencies [[`62a0e62a`](https://github.com/HoudiniGraphql/houdini/commit/62a0e62a476d6183d50bda21ed939c8f267308f0)]:
  - houdini@2.0.0-go.13

## 2.0.0-go.12

### Patch Changes

- [`c90c92b1`](https://github.com/HoudiniGraphql/houdini/commit/c90c92b1e5966b9756676abafc314b6b8e6439fe) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix compatability issue with go binary shim sand pnpm

- Updated dependencies []:
  - houdini@2.0.0-go.12

## 2.0.0-go.11

### Patch Changes

- Updated dependencies [[`2bf6cd4f`](https://github.com/HoudiniGraphql/houdini/commit/2bf6cd4fdfddec1324ba702d65436c46d50e3fe5)]:
  - houdini@2.0.0-go.11

## 2.0.0-go.10

### Patch Changes

- Updated dependencies [[`53fc6baa`](https://github.com/HoudiniGraphql/houdini/commit/53fc6baaa58d4022ae3495c1e0940b07e85d971c)]:
  - houdini@2.0.0-go.10

## 2.0.0-go.9

### Patch Changes

- Updated dependencies [[`d656515b`](https://github.com/HoudiniGraphql/houdini/commit/d656515bda5835d6e8a19b0e6eb8ecf5627fe34e)]:
  - houdini@2.0.0-go.9

## 2.0.0-go.8

### Patch Changes

- [`ae4cdfe4`](https://github.com/HoudiniGraphql/houdini/commit/ae4cdfe445503611ab56330fdc750f79a067ab8d) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix shim replacement for execution

- Updated dependencies []:
  - houdini@2.0.0-go.8

## 2.0.0-go.7

### Patch Changes

- [`2d60bc70`](https://github.com/HoudiniGraphql/houdini/commit/2d60bc70818bdcbefd3ba177bb56fc69b33f90ea) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - rework postinstall script

- Updated dependencies []:
  - houdini@2.0.0-go.7

## 2.0.0-go.6

### Patch Changes

- [`d66db310`](https://github.com/HoudiniGraphql/houdini/commit/d66db31026f37c1e8b5f661b8fbc05173b618a0e) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Attempt to fix post install script

- Updated dependencies []:
  - houdini@2.0.0-go.6

## 2.0.0-go.5

### Patch Changes

- [`7822a62e`](https://github.com/HoudiniGraphql/houdini/commit/7822a62e0421192000dbdf55a1c4379cdfe29358) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix files entry in published package

- Updated dependencies []:
  - houdini@2.0.0-go.5

## 2.0.0-go.4

### Patch Changes

- [`9bcf4188`](https://github.com/HoudiniGraphql/houdini/commit/9bcf4188dce2f153a07f3a9a47ffbd905def9da2) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix shim paths

- Updated dependencies [[`9bcf4188`](https://github.com/HoudiniGraphql/houdini/commit/9bcf4188dce2f153a07f3a9a47ffbd905def9da2)]:
  - houdini@2.0.0-go.4

## 2.0.0-go.3

### Patch Changes

- [`a74bf5f8`](https://github.com/HoudiniGraphql/houdini/commit/a74bf5f803d97686d98b2d78f28ea542cb6f9448) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - fix inter-workspace deps

- Updated dependencies [[`043c4e29`](https://github.com/HoudiniGraphql/houdini/commit/043c4e29ce2c2f41b4a6750b191983e5d53a3540), [`a74bf5f8`](https://github.com/HoudiniGraphql/houdini/commit/a74bf5f803d97686d98b2d78f28ea542cb6f9448)]:
  - houdini@2.0.0-go.3

## 2.0.0-go.2

### Patch Changes

- Updated dependencies [[`6fe29007`](https://github.com/HoudiniGraphql/houdini/commit/6fe290071bf356ef71567ebcbf025b1802f5cb42)]:
  - houdini@2.0.0-go.2

## 2.0.0-go.1

### Patch Changes

- [`07347a95`](https://github.com/HoudiniGraphql/houdini/commit/07347a9505ea11ba0d3e533979e96963b9001c06) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - bump houdini dep version

- Updated dependencies [[`07347a95`](https://github.com/HoudiniGraphql/houdini/commit/07347a9505ea11ba0d3e533979e96963b9001c06)]:
  - houdini@2.0.0-go.1

## 2.0.0-go.0

### Major Changes

- [`3af119a2`](https://github.com/HoudiniGraphql/houdini/commit/3af119a28ba88dd3b0e8902fdf94563354ebb765) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Implement new compiler architecture

### Patch Changes

- Updated dependencies [[`3af119a2`](https://github.com/HoudiniGraphql/houdini/commit/3af119a28ba88dd3b0e8902fdf94563354ebb765)]:
  - houdini@2.0.0-go.0

## 1.3.2

### Patch Changes

- [#1422](https://github.com/HoudiniGraphql/houdini/pull/1422) [`47f89581`](https://github.com/HoudiniGraphql/houdini/commit/47f895810a2340fe898f0c4fc4605e890f48fc9f) Thanks [@AlecAivazis](https://github.com/AlecAivazis)! - Fix bug causing dev serer to crash if there are syntax errors in a local schema

- Updated dependencies [[`1f11803e`](https://github.com/HoudiniGraphql/houdini/commit/1f11803e98ad9aada1b4fb068a51af7948e82da0), [`47f89581`](https://github.com/HoudiniGraphql/houdini/commit/47f895810a2340fe898f0c4fc4605e890f48fc9f), [`f07875bf`](https://github.com/HoudiniGraphql/houdini/commit/f07875bf1e50370cdfdb762eae9311f0cc1e680f), [`3d78749f`](https://github.com/HoudiniGraphql/houdini/commit/3d78749f4f917ee7e6edfa948ab62a1544f7d432)]:
  - houdini@1.4.2

## 1.3.1

### Patch Changes

- [#1415](https://github.com/HoudiniGraphql/houdini/pull/1415) [`d0b11685`](https://github.com/HoudiniGraphql/houdini/commit/d0b116852871af258a8c6a33ede6858c04295f70) Thanks @AlecAivazis! - Fix bug when url encoded route parameters contain url encodings

- Updated dependencies [[`d0b11685`](https://github.com/HoudiniGraphql/houdini/commit/d0b116852871af258a8c6a33ede6858c04295f70), [`d0b11685`](https://github.com/HoudiniGraphql/houdini/commit/d0b116852871af258a8c6a33ede6858c04295f70), [`d7b30f00`](https://github.com/HoudiniGraphql/houdini/commit/d7b30f00aaf974068a4a3b61a353bf2f9fa405e4)]:
  - houdini@1.4.1

## 1.3.0

### Minor Changes

- [#1402](https://github.com/HoudiniGraphql/houdini/pull/1402) [`21316ede`](https://github.com/HoudiniGraphql/houdini/commit/21316ede86e52dbdc3d0de7952385f9cb8307f46) Thanks @SeppahBaws! - Add support for vite 6

- [#1386](https://github.com/HoudiniGraphql/houdini/pull/1386) [`3c08996a`](https://github.com/HoudiniGraphql/houdini/commit/3c08996a17177937fb3cf97185660c9dda3c5cde) Thanks @endigma! - Added support for configuring Houdini's output directory

### Patch Changes

- Updated dependencies [[`d6375b6b`](https://github.com/HoudiniGraphql/houdini/commit/d6375b6b04ecd48fba663e83b3aed9b6b25e51b3), [`21316ede`](https://github.com/HoudiniGraphql/houdini/commit/21316ede86e52dbdc3d0de7952385f9cb8307f46), [`3c08996a`](https://github.com/HoudiniGraphql/houdini/commit/3c08996a17177937fb3cf97185660c9dda3c5cde), [`d2dbcd2d`](https://github.com/HoudiniGraphql/houdini/commit/d2dbcd2de9b77b855053ea7775dff1207eb60a4c)]:
  - houdini@1.4.0

## 1.2.66

### Patch Changes

- Updated dependencies [[`70dab292`](https://github.com/HoudiniGraphql/houdini/commit/70dab292b4590183f7c0ccfa3731c28c4ea3f6b1), [`24e6bef9`](https://github.com/HoudiniGraphql/houdini/commit/24e6bef9a28875e0026f9aa1ef0e71aba17447e2), [`fa869cea`](https://github.com/HoudiniGraphql/houdini/commit/fa869ceab903190f7c098bb02e7f838a3609e947)]:
  - houdini@1.3.1

## 1.2.65

### Patch Changes

- Updated dependencies [[`45b9bb80`](https://github.com/HoudiniGraphql/houdini/commit/45b9bb80fdecd80c788cc2be7157c64ef3a43a22), [`45b9bb80`](https://github.com/HoudiniGraphql/houdini/commit/45b9bb80fdecd80c788cc2be7157c64ef3a43a22)]:
  - houdini@1.3.0

## 1.2.65-next.0

### Patch Changes

- Updated dependencies [[`9fe06516`](https://github.com/HoudiniGraphql/houdini/commit/9fe06516becca5803b70c4455ee4a68a1ff1ad42), [`c39d14d0`](https://github.com/HoudiniGraphql/houdini/commit/c39d14d0ac721248789bef1a46af9a460740cf26)]:
  - houdini@1.3.0-next.0

## 1.2.64

### Patch Changes

- Updated dependencies []:
  - houdini@1.2.64

## 1.2.63

### Patch Changes

- Updated dependencies []:
  - houdini@1.2.63

## 1.2.62

### Patch Changes

- [#1352](https://github.com/HoudiniGraphql/houdini/pull/1352) [`2cf22c7c`](https://github.com/HoudiniGraphql/houdini/commit/2cf22c7ccae088b107770b819d2c0019054d3c6e) Thanks @AlecAivazis! - Add @dedupe directive

- Updated dependencies [[`2cf22c7c`](https://github.com/HoudiniGraphql/houdini/commit/2cf22c7ccae088b107770b819d2c0019054d3c6e)]:
  - houdini@1.2.62

## 1.2.61

### Patch Changes

- Updated dependencies []:
  - houdini@1.2.61

## 1.2.60

### Patch Changes

- Updated dependencies []:
  - houdini@1.2.60

## 1.2.59

### Patch Changes

- Updated dependencies []:
  - houdini@1.2.59

## 1.2.58

### Patch Changes

- Updated dependencies []:
  - houdini@1.2.58

## 1.2.57

### Patch Changes

- [#1350](https://github.com/HoudiniGraphql/houdini/pull/1350) [`fe0d7599`](https://github.com/HoudiniGraphql/houdini/commit/fe0d75996ac5632fe8a10dde85a3f59b036dd3c7) Thanks @AlecAivazis! - Fix bug when generating fresh project files with a local schema

- Updated dependencies [[`fe0d7599`](https://github.com/HoudiniGraphql/houdini/commit/fe0d75996ac5632fe8a10dde85a3f59b036dd3c7)]:
  - houdini@1.2.57

## 1.2.56

### Patch Changes

- Updated dependencies [[`1728454f`](https://github.com/HoudiniGraphql/houdini/commit/1728454f0f1ca6a35ad5c4c039cc6e2f6212ab25)]:
  - houdini@1.2.56

## 1.2.55

### Patch Changes

- [#1337](https://github.com/HoudiniGraphql/houdini/pull/1337) [`5add29a6`](https://github.com/HoudiniGraphql/houdini/commit/5add29a68489fd9382d0809cf574a1db2746aae8) Thanks @AlecAivazis! - Various fixes for optimistic use cases

- Updated dependencies [[`98859e78`](https://github.com/HoudiniGraphql/houdini/commit/98859e78e088cf733edc35b3ad96b1a1f9f48b79), [`5add29a6`](https://github.com/HoudiniGraphql/houdini/commit/5add29a68489fd9382d0809cf574a1db2746aae8)]:
  - houdini@1.2.55

## 1.2.54

### Patch Changes

- Updated dependencies []:
  - houdini@1.2.54

## 1.2.53

### Patch Changes

- Updated dependencies [[`389de558`](https://github.com/HoudiniGraphql/houdini/commit/389de558fa52ed0ec6fd37f1aac1d3e12da9da02)]:
  - houdini@1.2.53

## 1.2.52

### Patch Changes

- Updated dependencies [[`69b7781e`](https://github.com/HoudiniGraphql/houdini/commit/69b7781e11b0824081be8a863a574d176d6bd138)]:
  - houdini@1.2.52

## 1.2.51

### Patch Changes

- Updated dependencies [[`90901979`](https://github.com/HoudiniGraphql/houdini/commit/90901979bbd7f70df166b21f5fe7cf0ffc71ad1d)]:
  - houdini@1.2.51

## 1.2.50

### Patch Changes

- Updated dependencies [[`75999ca0`](https://github.com/HoudiniGraphql/houdini/commit/75999ca0a1a743579351a9b8a04b26dc31b1dc3c)]:
  - houdini@1.2.50

## 1.2.49

### Dependency Changes

- Updated dependencies [[`a0a67eab`](https://github.com/HoudiniGraphql/houdini/commit/a0a67eab658acf1108049d5f2c304ef335716082), [`c9a019de`](https://github.com/HoudiniGraphql/houdini/commit/c9a019ded20018116dde50f50f1e4d31dd89e189), [`ba4be40f`](https://github.com/HoudiniGraphql/houdini/commit/ba4be40f6b5820582bf1ca213a36babbba1e55c3)]:
  - houdini@1.2.49

## 1.2.48

### Dependency Changes

- Updated dependencies [[`e21f7c6a`](https://github.com/HoudiniGraphql/houdini/commit/e21f7c6a700eafe7c2eaa5f9ce6856a64f5abba7)]:
  - houdini@1.2.48

## 1.2.47

### 🐛 Fixes

- [#1297](https://github.com/HoudiniGraphql/houdini/pull/1297) [`d1686d0c`](https://github.com/HoudiniGraphql/houdini/commit/d1686d0cd912808bfe6101faf2c2d2ccb8390ac1) Thanks @AlecAivazis! - fix bug with useRoute pulling route params

### Dependency Changes

- Updated dependencies [[`e6368686`](https://github.com/HoudiniGraphql/houdini/commit/e6368686cd283f46c77755efb70701aa1da729fe)]:
  - houdini@1.2.47

## 1.2.46

### 🐛 Fixes

- [#1291](https://github.com/HoudiniGraphql/houdini/pull/1291) [`c1628ef0`](https://github.com/HoudiniGraphql/houdini/commit/c1628ef0706f825744a2f95ca324b6a552a30d93) Thanks @AlecAivazis! - Fix $handle reference

### Dependency Changes

- Updated dependencies [[`f45e9126`](https://github.com/HoudiniGraphql/houdini/commit/f45e9126e2481cfcd67043e1f5bd7bef6575acaf), [`6820d36e`](https://github.com/HoudiniGraphql/houdini/commit/6820d36ea4f452f904319a322afa44f6765b5285)]:
  - houdini@1.2.46

## 1.2.45

### ✨ Features

- [#1284](https://github.com/HoudiniGraphql/houdini/pull/1284) [`d69d1725`](https://github.com/HoudiniGraphql/houdini/commit/d69d172560c05947a44c548741cc29d6a22e0416) Thanks @AlecAivazis! - Add useRoute prop for typesafe route parameters

### 🐛 Fixes

- [#1282](https://github.com/HoudiniGraphql/houdini/pull/1282) [`250ff786`](https://github.com/HoudiniGraphql/houdini/commit/250ff7868e3fae562ec077ffd740b7d9a901bf53) Thanks @AlecAivazis! - Fix bug marshaling/unmarshaling scalars over network

### Dependency Changes

- Updated dependencies [[`7f426d94`](https://github.com/HoudiniGraphql/houdini/commit/7f426d94bc13d061c39e19310f6e5de48ea4e219)]:
  - houdini@1.2.45

## 1.2.44

### ✨ Features

- [#1280](https://github.com/HoudiniGraphql/houdini/pull/1280) [`4e31fbba`](https://github.com/HoudiniGraphql/houdini/commit/4e31fbba4faea5e98fda8befcedce76d71e6849b) Thanks @AlecAivazis! - Add useLocation and useSession hooks

### Dependency Changes

- Updated dependencies [[`50a9fa13`](https://github.com/HoudiniGraphql/houdini/commit/50a9fa13958a8dd0becbd66f2b3f3437aae0aa1d), [`4e31fbba`](https://github.com/HoudiniGraphql/houdini/commit/4e31fbba4faea5e98fda8befcedce76d71e6849b)]:
  - houdini@1.2.44

## 1.2.43

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.43

## 1.2.42

### Patch Changes

- [#1275](https://github.com/HoudiniGraphql/houdini/pull/1275) [`b8110193`](https://github.com/HoudiniGraphql/houdini/commit/b8110193136eb6a552c534f6b4fdd68f7d57c329) Thanks @AlecAivazis! - Always generate route component types even if the file hasn't been saved yet

- [#1275](https://github.com/HoudiniGraphql/houdini/pull/1275) [`b8110193`](https://github.com/HoudiniGraphql/houdini/commit/b8110193136eb6a552c534f6b4fdd68f7d57c329) Thanks @AlecAivazis! - Fix corruption of image files on deployment

- Updated dependencies []:
  - houdini@1.2.42

## 1.2.41

### Patch Changes

- [#1272](https://github.com/HoudiniGraphql/houdini/pull/1272) [`45a35bd5`](https://github.com/HoudiniGraphql/houdini/commit/45a35bd543316dc9209bfea28e9e514c2344612d) Thanks @AlecAivazis! - Fixed issue prevent logins when deployed on cloudflare

- Updated dependencies []:
  - houdini@1.2.41

## 1.2.40

### Patch Changes

- [#1269](https://github.com/HoudiniGraphql/houdini/pull/1269) [`fe0ee152`](https://github.com/HoudiniGraphql/houdini/commit/fe0ee1522110609676d98507ca49bd6354c9cded) Thanks @AlecAivazis! - Queries now throw errors when they are encountered in an API response

- Updated dependencies []:
  - houdini@1.2.40

## 1.2.39

### Dependency Changes

- Updated dependencies [[`45c66b33`](https://github.com/HoudiniGraphql/houdini/commit/45c66b334edc749c889b74103221f726350d8025)]:
  - houdini@1.2.39

## 1.2.38

### Dependency Changes

- Updated dependencies [[`a84b7c5f`](https://github.com/HoudiniGraphql/houdini/commit/a84b7c5f9a2f5cc5ec806afef5cd4e640a9bbfb5), [`d22a395d`](https://github.com/HoudiniGraphql/houdini/commit/d22a395d2b4295a1db3c0e9ce61c5be8e57197fa)]:
  - houdini@1.2.38

## 1.2.37

### Dependency Changes

- Updated dependencies [[`5cf1c72e`](https://github.com/HoudiniGraphql/houdini/commit/5cf1c72e4f1e5c585d05bcbdc67095d8aa68bd32), [`21ef04bf`](https://github.com/HoudiniGraphql/houdini/commit/21ef04bffce6e22a49e0294e1618a2a9f879f43d), [`d1899949`](https://github.com/HoudiniGraphql/houdini/commit/d18999499ef3b773a4654363e625dcc04db5d291)]:
  - houdini@1.2.37

## 1.2.36

### Dependency Changes

- Updated dependencies [[`ffa2b2a6`](https://github.com/HoudiniGraphql/houdini/commit/ffa2b2a6af6c06281923e14bd3d53bf54ec33792)]:
  - houdini@1.2.36

## 1.2.35

### Dependency Changes

- Updated dependencies [[`c86501ae`](https://github.com/HoudiniGraphql/houdini/commit/c86501ae87b8d2a64946711ba842459d941eccf9)]:
  - houdini@1.2.35

## 1.2.34

### 🐛 Fixes

- [#1236](https://github.com/HoudiniGraphql/houdini/pull/1236) [`1ff715bd`](https://github.com/HoudiniGraphql/houdini/commit/1ff715bd8810c6d934a68bc47b581b2317582c9f) Thanks @AlecAivazis! - Fix bug when dash present in route name

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.34

## 1.2.33

### Dependency Changes

- Updated dependencies [[`1a736fc2`](https://github.com/HoudiniGraphql/houdini/commit/1a736fc23aefbfcc7b003d5d1d194ee37c8a8ecb)]:
  - houdini@1.2.33

## 1.2.32

### Dependency Changes

- Updated dependencies [[`ae73932d`](https://github.com/HoudiniGraphql/houdini/commit/ae73932da26e9e960dfeb916536048ab99701e98)]:
  - houdini@1.2.32

## 1.2.31

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.31

## 1.2.28

### ✨ Features

- [#1216](https://github.com/HoudiniGraphql/houdini/pull/1216) [`d7fe2be4`](https://github.com/HoudiniGraphql/houdini/commit/d7fe2be4087d7da37d454d0da3071a521f8e84e6) Thanks @AlecAivazis! - Stabilize react deployments

- [#1176](https://github.com/HoudiniGraphql/houdini/pull/1176) [`a5d6a842`](https://github.com/HoudiniGraphql/houdini/commit/a5d6a8428142e1848bea28dcf88484a5a9aa2660) Thanks @AlecAivazis! - Added experimental support for componentFields

### 🐛 Fixes

- [#1216](https://github.com/HoudiniGraphql/houdini/pull/1216) [`d7fe2be4`](https://github.com/HoudiniGraphql/houdini/commit/d7fe2be4087d7da37d454d0da3071a521f8e84e6) Thanks @AlecAivazis! - Fix session redirects

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.28

## 1.2.27

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.27

## 1.2.26

### 🐛 Fixes

- [#1205](https://github.com/HoudiniGraphql/houdini/pull/1205) [`e05f1c25`](https://github.com/HoudiniGraphql/houdini/commit/e05f1c250edb48722ee45c2a62de72f4a19d3357) Thanks @AlecAivazis! - Fix invalid import during dev

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.26

## 1.2.25

### Dependency Changes

- [`0c81de6c`](https://github.com/HoudiniGraphql/houdini/commit/0c81de6ca4a266a646948a09bdc83428379504f3) Thanks @AlecAivazis! - Improve integration with vite dev server

- Updated dependencies []:
  - houdini@1.2.25

## 1.2.24

### Dependency Changes

- [`d5559503`](https://github.com/HoudiniGraphql/houdini/commit/d55595038b95ccef3e19860e10af63a014a039fa) Thanks @AlecAivazis! - Fix base url in dev mod

- Updated dependencies []:
  - houdini@1.2.24

## 1.2.23

### 🐛 Fixes

- [#1196](https://github.com/HoudiniGraphql/houdini/pull/1196) [`e92ea8fd`](https://github.com/HoudiniGraphql/houdini/commit/e92ea8fd7322789fccb124ccd9e1d8bb2149059e) Thanks @AlecAivazis! - Fix hot module reloading

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.23

## 1.2.22

### Dependency Changes

- Updated dependencies [[`c0fef15f`](https://github.com/HoudiniGraphql/houdini/commit/c0fef15f892d7398f2cae3deac82f0801d04e3bb)]:
  - houdini@1.2.22

## 1.2.21

### Dependency Changes

- Updated dependencies [[`2cc489dd`](https://github.com/HoudiniGraphql/houdini/commit/2cc489dd266e5670cc54975b3720498b3fffbe50)]:
  - houdini@1.2.21

## 1.2.20

### 🐛 Fixes

- [#1186](https://github.com/HoudiniGraphql/houdini/pull/1186) [`bcc8b969`](https://github.com/HoudiniGraphql/houdini/commit/bcc8b969df9d26f140be034b2390487328762f74) Thanks @AlecAivazis! - Build and dev can both run on a fresh project

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.20

## 1.2.19

### Dependency Changes

- Updated dependencies [[`65c703c6`](https://github.com/HoudiniGraphql/houdini/commit/65c703c6c97e3ae4cdc8c676594a36f40ac70844)]:
  - houdini@1.2.19

## 1.2.18

### 🐛 Fixes

- [`7f6432a6`](https://github.com/HoudiniGraphql/houdini/commit/7f6432a6be5bd7bb7831f21ebe134698f1e2f072) Thanks @AlecAivazis! - Get all packages at same version

### Dependency Changes

- Updated dependencies [[`7f6432a6`](https://github.com/HoudiniGraphql/houdini/commit/7f6432a6be5bd7bb7831f21ebe134698f1e2f072)]:
  - houdini@1.2.18

## 1.2.17

### 🐛 Fixes

- [`245c8a23`](https://github.com/HoudiniGraphql/houdini/commit/245c8a23ef9cb46609e1f052eabb67a95ee4d3cd) Thanks @AlecAivazis! - Fix generated path in fallbacks

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.17

## 1.2.16

### 🐛 Fixes

- [#1179](https://github.com/HoudiniGraphql/houdini/pull/1179) [`20702a9c`](https://github.com/HoudiniGraphql/houdini/commit/20702a9c3bb1cd87a54976dd3b686e4e715df263) Thanks @AlecAivazis! - Fix another bug when deploying a fresh installation

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.16

## 1.2.15

### 🐛 Fixes

- [#1177](https://github.com/HoudiniGraphql/houdini/pull/1177) [`8831c147`](https://github.com/HoudiniGraphql/houdini/commit/8831c14752920d868bab0f6e7ccbe34c85a3067b) Thanks @AlecAivazis! - Fix error preventing succesfull build

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.15

## 1.2.14

### ✨ Features

- [#1170](https://github.com/HoudiniGraphql/houdini/pull/1170) [`76b3c28a`](https://github.com/HoudiniGraphql/houdini/commit/76b3c28abe2e5252f883b2468b31c3880c0356b5) Thanks @AlecAivazis! - Streamline adapter codegen api

### Dependency Changes

- Updated dependencies [[`386fc4c5`](https://github.com/HoudiniGraphql/houdini/commit/386fc4c5b604a40586aba47533f83a1f5a3723d9)]:
  - houdini@1.2.14

## 1.2.13

### Dependency Changes

- Updated dependencies [[`41e3bdbf`](https://github.com/HoudiniGraphql/houdini/commit/41e3bdbf9a1bcc029fb8ef56fe91f7116a42a3b1), [`8741ff3a`](https://github.com/HoudiniGraphql/houdini/commit/8741ff3a1594c79400a99f102e8d84801d44ae87)]:
  - houdini@1.2.13

## 1.2.12

### ✨ Features

- [#1160](https://github.com/HoudiniGraphql/houdini/pull/1160) [`781e12f5`](https://github.com/HoudiniGraphql/houdini/commit/781e12f5ec14f736ec30216ba31d5a1dee21f6c8) @AlecAivazis! - Add support for local schemas

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.12

## 1.2.11

### ✨ Features

- [#1158](https://github.com/HoudiniGraphql/houdini/pull/1158) [`daa13c1c`](https://github.com/HoudiniGraphql/houdini/commit/daa13c1cc5f5ead19cff61c37d1b39bd36c4d139) Thanks @AlecAivazis! - Add ability to opt-into preloading a specific link with data-houdini-preload

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.11

## 1.2.10

### ✨ Features

- [#1155](https://github.com/HoudiniGraphql/houdini/pull/1155) [`adf90d3`](https://github.com/HoudiniGraphql/houdini/commit/adf90d3c3406c79c9b07060c764bf41289bf2a38) Thanks @AlecAivazis! - Add cloudflare adapter

- [#1152](https://github.com/HoudiniGraphql/houdini/pull/1152) [`6b9fbb7`](https://github.com/HoudiniGraphql/houdini/commit/6b9fbb7a9ce3e0fdf45637e76f2e5c9a2bc58e98) Thanks @AlecAivazis! - Remove Link component in favor of event delegation

### Dependency Changes

- Updated dependencies [[`adf90d3`](https://github.com/HoudiniGraphql/houdini/commit/adf90d3c3406c79c9b07060c764bf41289bf2a38), [`adf90d3`](https://github.com/HoudiniGraphql/houdini/commit/adf90d3c3406c79c9b07060c764bf41289bf2a38)]:
  - houdini@1.2.10

## 1.2.9

### 🐛 Fixes

- [#1147](https://github.com/HoudiniGraphql/houdini/pull/1147) @jycouet - if cookie name not found don't return session

### Dependency Changes

- Updated dependencies []:
  - houdini@1.2.9

## 1.2.8

### Dependency Changes

- Updated dependencies [[`4618271`](https://github.com/HoudiniGraphql/houdini/commit/46182715a61042b43d1433f3f620c71632550f98)]:
  - houdini@1.2.8

## 1.2.7

### Dependency Changes

- Updated dependencies [[`18571f8`](https://github.com/HoudiniGraphql/houdini/commit/18571f81faffeda311c6f6125c2b2ad17f6cc66e), [`18571f8`](https://github.com/HoudiniGraphql/houdini/commit/18571f81faffeda311c6f6125c2b2ad17f6cc66e), [`2d2d6c7`](https://github.com/HoudiniGraphql/houdini/commit/2d2d6c779aca76af375f57644027954e89886d7d), [`8618b66`](https://github.com/HoudiniGraphql/houdini/commit/8618b6631a8f51f6c4f6724199e25a5f8e05d0b5)]:
  - houdini@1.2.7

## 1.2.6

### Dependency Changes

- Updated dependencies [[`1fc47b8`](https://github.com/HoudiniGraphql/houdini/commit/1fc47b8f1528aa9f24f3604a8fb3794f95d9754e), [`891a8c7`](https://github.com/HoudiniGraphql/houdini/commit/891a8c72b89af39f17b402485cea642946375278), [`743d85d`](https://github.com/HoudiniGraphql/houdini/commit/743d85d1490128dd3d9c7a419efdc4b65f996418), [`35cc897`](https://github.com/HoudiniGraphql/houdini/commit/35cc897cb98d3952139d9f06fb6bcba40c249ccd), [`91b445f`](https://github.com/HoudiniGraphql/houdini/commit/91b445f0c1d9e35608e9f3c76ad5cbf51ff93217)]:
  - houdini@1.2.6

## 1.2.6-next.0

### Dependency Changes

- Updated dependencies [[`1fc47b8`](https://github.com/HoudiniGraphql/houdini/commit/1fc47b8f1528aa9f24f3604a8fb3794f95d9754e), [`891a8c7`](https://github.com/HoudiniGraphql/houdini/commit/891a8c72b89af39f17b402485cea642946375278), [`743d85d`](https://github.com/HoudiniGraphql/houdini/commit/743d85d1490128dd3d9c7a419efdc4b65f996418), [`35cc897`](https://github.com/HoudiniGraphql/houdini/commit/35cc897cb98d3952139d9f06fb6bcba40c249ccd)]:
  - houdini@1.2.6-next.0

## 1.2.5

### Dependency Changes

- Updated dependencies [[`bc96dfb`](https://github.com/HoudiniGraphql/houdini/commit/bc96dfb78e8df7e57c2cca7aee88a32d38c7565e), [`cb0310c`](https://github.com/HoudiniGraphql/houdini/commit/cb0310c3467d170a9a0cf012787bd59272b1e8bb)]:
  - houdini@1.2.5

## 1.2.4

### Dependency Changes

- Updated dependencies [[`5daf4c4`](https://github.com/HoudiniGraphql/houdini/commit/5daf4c407123a08f81bd20c6b963df94ee26e2c3)]:
  - houdini@1.2.4

## 1.2.3

### Dependency Changes

- Updated dependencies [[`1e98daf`](https://github.com/HoudiniGraphql/houdini/commit/1e98daff3dd420e86fb913a01d34644316c57955), [`1e98daf`](https://github.com/HoudiniGraphql/houdini/commit/1e98daff3dd420e86fb913a01d34644316c57955)]:
  - houdini@1.2.3

## 1.2.2

### Dependency Changes

- Updated dependencies [[`6958699`](https://github.com/HoudiniGraphql/houdini/commit/6958699d8e685dd129cbcc09d2f9099c9353bd12)]:
  - houdini@1.2.2

## 1.2.1

### Dependency Changes

- Updated dependencies [[`5f3bc42`](https://github.com/HoudiniGraphql/houdini/commit/5f3bc42dcd1cf4f8dddd45e8064e5f3a994c6eeb), [`c0bc1fc`](https://github.com/HoudiniGraphql/houdini/commit/c0bc1fc46c571a4df5cae0b7c7a1f87589f11997)]:
  - houdini@1.2.1

## 1.2.0

### ✨ Features

- [#1044](https://github.com/HoudiniGraphql/houdini/pull/1044) [`987a6f2`](https://github.com/HoudiniGraphql/houdini/commit/987a6f24b3fd453dafdbc03ae2de610a8c4cd257) Thanks @AlecAivazis! - Add suspense integration

### Dependency Changes

- [#1050](https://github.com/HoudiniGraphql/houdini/pull/1050) [`8e8b214`](https://github.com/HoudiniGraphql/houdini/commit/8e8b2148973f0f36a726bc5a79e5107ce79123c6) Thanks [@devunt](https://github.com/devunt)! - Centralize JS code parsing/printing mechanism into core

- [#1048](https://github.com/HoudiniGraphql/houdini/pull/1048) [`184ddbd`](https://github.com/HoudiniGraphql/houdini/commit/184ddbdf0e82da56b479c5009f105f04fd6ac00e) Thanks [@mpellegrini](https://github.com/mpellegrini)! - Include explicit types export conditions in package.json exports

- Updated dependencies [[`635ba76`](https://github.com/HoudiniGraphql/houdini/commit/635ba76ef24f7d122315adce74cb94257bd59d68), [`46eb9c1`](https://github.com/HoudiniGraphql/houdini/commit/46eb9c110842ac3db5d3319a2cef4f1365bfa008), [`31e8f6d`](https://github.com/HoudiniGraphql/houdini/commit/31e8f6d8072ebc7e30921b9cc811b5b568f03017), [`d92bfc0`](https://github.com/HoudiniGraphql/houdini/commit/d92bfc02e8419914d6c347714d08b0251f6081e9), [`8e8b214`](https://github.com/HoudiniGraphql/houdini/commit/8e8b2148973f0f36a726bc5a79e5107ce79123c6), [`46eb9c1`](https://github.com/HoudiniGraphql/houdini/commit/46eb9c110842ac3db5d3319a2cef4f1365bfa008), [`361e2b5`](https://github.com/HoudiniGraphql/houdini/commit/361e2b5a5b36b9db42f75486e0fedf39a778432c), [`7d624fe`](https://github.com/HoudiniGraphql/houdini/commit/7d624fec9417152ec2560b36efbcc21bd694e378), [`184ddbd`](https://github.com/HoudiniGraphql/houdini/commit/184ddbdf0e82da56b479c5009f105f04fd6ac00e), [`46eb9c1`](https://github.com/HoudiniGraphql/houdini/commit/46eb9c110842ac3db5d3319a2cef4f1365bfa008), [`7161781`](https://github.com/HoudiniGraphql/houdini/commit/71617814116ce4ead9fce2c7aeef2391a952f8a5)]:
  - houdini@1.2.0

## 1.1.7

### Dependency Changes

- Updated dependencies [[`151a107`](https://github.com/HoudiniGraphql/houdini/commit/151a10718b92fb97eec6e94ea12efc7f98928755)]:
  - houdini@1.1.7

## 1.1.6

### Dependency Changes

- Updated dependencies [[`f0c11433`](https://github.com/HoudiniGraphql/houdini/commit/f0c11433a1403e9e0a2d53031f23483fa3e486df)]:
  - houdini@1.1.6

## 1.1.5

### Dependency Changes

- Updated dependencies [[`5305a2ad`](https://github.com/HoudiniGraphql/houdini/commit/5305a2ad36e692d47f5fb4cfa2c5a2e4d9ef3d4d), [`5a6e188d`](https://github.com/HoudiniGraphql/houdini/commit/5a6e188d88a4b7f84511a84ddc1bcc2c1ff59f5f), [`be51b0f5`](https://github.com/HoudiniGraphql/houdini/commit/be51b0f5e5fdde4f48288bfcede2c46b4bddf01f)]:
  - houdini@1.1.5

## 1.1.4

### Dependency Changes

- Updated dependencies [[`184a8417`](https://github.com/HoudiniGraphql/houdini/commit/184a84170bc803c37cd25993c9877a2187c91da3), [`16b8b882`](https://github.com/HoudiniGraphql/houdini/commit/16b8b882c66c96942bd5f4f3fddaffc62a30d8fa), [`dfc4295a`](https://github.com/HoudiniGraphql/houdini/commit/dfc4295a5bc20fdcc24b671f1faa910b5e91ba61)]:
  - houdini@1.1.4

## 1.1.3

### Dependency Changes

- Updated dependencies []:
  - houdini@1.1.3

## 1.1.2

### Dependency Changes

- Updated dependencies [[`09c35bb6`](https://github.com/HoudiniGraphql/houdini/commit/09c35bb60a605894c8360037e757280f0b899bc3), [`f7fd8777`](https://github.com/HoudiniGraphql/houdini/commit/f7fd87770178014f49d6f50f86a7402269642f21)]:
  - houdini@1.1.2

## 1.1.1

### Dependency Changes

- Updated dependencies [[`54e8c453`](https://github.com/HoudiniGraphql/houdini/commit/54e8c4535ce7b9d0d29f9ef4073e173652bf0cb3)]:
  - houdini@1.1.1

## 1.1.0

### Dependency Changes

- Updated dependencies [[`f94b6ca`](https://github.com/HoudiniGraphql/houdini/commit/f94b6caf8bda21fdbe22b466dc01cb8f8f40448f)]:
  - houdini@1.1.0

## 1.0.11

### Dependency Changes

- Updated dependencies []:
  - houdini@1.0.11

## 1.0.10

### Dependency Changes

- Updated dependencies [[`38a54b8f`](https://github.com/HoudiniGraphql/houdini/commit/38a54b8f6858e35bb6bdf7a09c357959675a555a)]:
  - houdini@1.0.10

## 1.0.9

### Dependency Changes

- Updated dependencies []:
  - houdini@1.0.9

## 1.0.8

### Dependency Changes

- Updated dependencies [[`3240b8e`](https://github.com/HoudiniGraphql/houdini/commit/3240b8e0719c5dffb0d6034ea7ad4b3615b01faa), [`8e2f8e0`](https://github.com/HoudiniGraphql/houdini/commit/8e2f8e0d5b96f34a01dfcbc510ab1b0c3cfa9822), [`b223c60`](https://github.com/HoudiniGraphql/houdini/commit/b223c6079bb4a19d5708ad7daf905fe913dbec1e), [`b223c60`](https://github.com/HoudiniGraphql/houdini/commit/b223c6079bb4a19d5708ad7daf905fe913dbec1e)]:
  - houdini@1.0.8

## 1.0.7

### Dependency Changes

- Updated dependencies [[`52326b5`](https://github.com/HoudiniGraphql/houdini/commit/52326b5b54c1e722d398031e4b61281379cb8820)]:
  - houdini@1.0.7

## 1.0.6

### Dependency Changes

- Updated dependencies [[`8fd052c`](https://github.com/HoudiniGraphql/houdini/commit/8fd052c1d59fbb37e17da1bc42ae386a660440ed)]:
  - houdini@1.0.6

## 1.0.5

### Dependency Changes

- Updated dependencies [[`f69f9f1`](https://github.com/HoudiniGraphql/houdini/commit/f69f9f1b12cf9bca5d0112db2e78c4d4e94b4845), [`92c533e`](https://github.com/HoudiniGraphql/houdini/commit/92c533e2ba0aae7ceaebe7407691ff36482a71f4)]:
  - houdini@1.0.5

## 1.0.4

### Dependency Changes

- Updated dependencies [[`8e18042`](https://github.com/HoudiniGraphql/houdini/commit/8e1804227ee056f3b51c00f04832f4f997fdf1bc)]:
  - houdini@1.0.4

## 1.0.3

### Dependency Changes

- Updated dependencies [[`c9a6c86`](https://github.com/HoudiniGraphql/houdini/commit/c9a6c86ca8873f6fe52591b17aeeecc2e6a02014), [`64af71b`](https://github.com/HoudiniGraphql/houdini/commit/64af71b11bd5f07ff2d035a72d483bcf69834bf3)]:
  - houdini@1.0.3

## 1.0.2

### Dependency Changes

- Updated dependencies []:
  - houdini@1.0.2

## 1.0.1

### Dependency Changes

- Updated dependencies [[`0f8f7ba`](https://github.com/HoudiniGraphql/houdini/commit/0f8f7ba626caabe847e2a94d467fe965184c0afa), [`0f8f7ba`](https://github.com/HoudiniGraphql/houdini/commit/0f8f7ba626caabe847e2a94d467fe965184c0afa)]:
  - houdini@1.0.1

## 1.0.0
