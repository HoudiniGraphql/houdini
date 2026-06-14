#!/usr/bin/env sh
# Usage: pnpm watch-bench [category]
# Categories: core, subscriptions, lists, multi-doc, optimistic, gc, ssr
# Omit category to watch all suites.
BENCH=${1:-all} BENCH_QUICK=1 vitest bench packages/houdini/src/runtime/cache/benchmarks/ --watch
