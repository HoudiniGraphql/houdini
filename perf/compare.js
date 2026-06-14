#!/usr/bin/env node
// Compare two vitest benchmark JSON output files and fail on regressions.
//
// Usage:
//   node perf/compare.js [baseline] [current]
//
// Defaults:
//   baseline = perf/benchmark.json       (committed reference run)
//   current  = perf/benchmark.current.json  (produced by pnpm bench:check)
//
// Environment:
//   BENCH_THRESHOLD  — regression threshold in percent (default: 1)
//
// Exit codes:
//   0  all benchmarks within threshold
//   1  one or more regressions detected

import { copyFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const threshold = parseFloat(process.env.BENCH_THRESHOLD ?? '1') / 100
const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const [, , baselineArg, currentArg] = process.argv
const baselinePath = resolve(root, baselineArg ?? 'perf/benchmark.json')
const currentPath = resolve(root, currentArg ?? 'perf/benchmark.current.json')

function flattenReport(path) {
    const report = JSON.parse(readFileSync(path, 'utf8'))
    const flat = new Map()
    for (const file of report.files) {
        for (const group of file.groups) {
            // Strip the leading "filepath > " prefix so keys are stable across
            // machines and worktrees.
            const suiteName = group.fullName.split(' > ').slice(1).join(' > ')
            for (const bench of group.benchmarks) {
                flat.set(`${suiteName} > ${bench.name}`, bench)
            }
        }
    }
    return flat
}

const baseline = flattenReport(baselinePath)
const current = flattenReport(currentPath)

const regressions = []
const rows = []

for (const [key, curr] of current) {
    const base = baseline.get(key)
    if (!base) {
        rows.push({ key, baseHz: null, currHz: curr.hz, delta: null, status: 'new' })
        continue
    }
    // hz: operations per second — higher is better
    const delta = (curr.hz - base.hz) / base.hz
    const status = delta < -threshold ? 'REGRESS' : delta > threshold ? 'improve' : 'ok'
    if (status === 'REGRESS') regressions.push(key)
    rows.push({ key, baseHz: base.hz, currHz: curr.hz, delta, status })
}

// Format helpers
const fmtHz = (n) =>
    n == null ? '           -' : Math.round(n).toLocaleString('en-US').padStart(12)
const fmtPct = (d) =>
    d == null ? '       -' : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(2)}%`.padStart(8)

const nameWidth = Math.max(25, ...rows.map((r) => r.key.length))
const header = `${'benchmark'.padEnd(nameWidth)}  ${'baseline (hz)'.padStart(12)}  ${'current (hz)'.padStart(12)}  ${'change'.padStart(8)}  status`
const rule = '-'.repeat(header.length)

console.log(`\ncomparing:\n  baseline: ${baselinePath}\n  current:  ${currentPath}`)
console.log(`regression threshold: ${(threshold * 100).toFixed(1)}%\n`)
console.log(header)
console.log(rule)

for (const r of rows) {
    const flag =
        r.status === 'REGRESS'
            ? '  ← REGRESSION'
            : r.status === 'new'
              ? '  (new)'
              : ''
    console.log(
        `${r.key.padEnd(nameWidth)}  ${fmtHz(r.baseHz)}  ${fmtHz(r.currHz)}  ${fmtPct(r.delta)}  ${r.status}${flag}`
    )
}

console.log(rule)

if (regressions.length > 0) {
    console.error(
        `\n${regressions.length} regression${regressions.length === 1 ? '' : 's'} detected (>${(threshold * 100).toFixed(1)}% slower than baseline):\n`
    )
    for (const key of regressions) console.error(`  ${key}`)
    console.error()
    process.exit(1)
} else {
    console.log(`\nall ${rows.filter((r) => r.status !== 'new').length} benchmarks within ${(threshold * 100).toFixed(1)}% of baseline.`)
    copyFileSync(currentPath, baselinePath)
    console.log(`baseline updated: ${baselinePath}\n`)
}
