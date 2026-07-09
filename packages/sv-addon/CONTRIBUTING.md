# Contributing Guide

Cheatsheet: [All official add-ons source code](https://github.com/sveltejs/cli/tree/main/packages/sv/src/addons)

---

Some convenient scripts are provided to help develop the add-on.

```sh
## create a new minimal project in the `demo` directory
pnpm demo-create

## add your current add-on to the demo project
pnpm demo-add

## run the tests
pnpm test
```

## Building

The add-on is bundled with [tsdown](https://tsdown.dev/) into a single file in `dist/`. This bundles everything except `sv` (which is a peer dependency provided at runtime).

```sh
pnpm build
```
