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
//   BENCH_THRESHOLD  — minimum regression threshold in percent (default: 5).
//                      A benchmark is only flagged if the drop exceeds BOTH
//                      this floor AND the noise band (see RME_MULTIPLIER).
//   RME_MULTIPLIER   — how many combined RME widths must be exceeded before a
//                      change counts as a real regression (default: 2).
//                      Effective per-benchmark threshold is:
//                        max(BENCH_THRESHOLD, RME_MULTIPLIER × combinedRme)
//                      where combinedRme = sqrt(rme_base² + rme_curr²).
//                      At 2× you need ~95% confidence the change is real.
//
// Exit codes:
//   0  all benchmarks within threshold
//   1  one or more regressions detected

import { copyFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const floorThreshold = parseFloat(process.env.BENCH_THRESHOLD ?? '7') / 100
const rmeMultiplier = parseFloat(process.env.RME_MULTIPLIER ?? '2')
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

let baseline
try {
    baseline = flattenReport(baselinePath)
} catch {
    // No baseline yet — treat the current run as the initial snapshot.
    copyFileSync(currentPath, baselinePath)
    console.log(`no baseline found — wrote initial snapshot to ${baselinePath}\n`)
    process.exit(0)
}

const current = flattenReport(currentPath)

const regressions = []
const rows = []

for (const [key, curr] of current) {
    const base = baseline.get(key)
    if (!base) {
        rows.push({ key, baseHz: null, currHz: curr.hz, rme: null, effectiveThreshold: null, delta: null, status: 'new' })
        continue
    }

    const delta = (curr.hz - base.hz) / base.hz

    // Per-benchmark noise band: sqrt(rme_base² + rme_curr²), expressed as a fraction.
    // rme is stored as a percentage in the JSON (e.g. 1.5 means 1.5%).
    const combinedRme = Math.sqrt((base.rme / 100) ** 2 + (curr.rme / 100) ** 2)
    const effectiveThreshold = Math.max(floorThreshold, rmeMultiplier * combinedRme)

    const status =
        delta < -effectiveThreshold ? 'REGRESS' : delta > effectiveThreshold ? 'improve' : 'ok'
    if (status === 'REGRESS') regressions.push({ key, delta, effectiveThreshold })
    rows.push({ key, baseHz: base.hz, currHz: curr.hz, rme: combinedRme, effectiveThreshold, delta, status })
}

// Format helpers
const fmtHz = (n) =>
    n == null ? '           -' : Math.round(n).toLocaleString('en-US').padStart(12)
const fmtPct = (d) =>
    d == null ? '      -' : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`.padStart(7)

const nameWidth = Math.max(25, ...rows.map((r) => r.key.length))
const header = `${'benchmark'.padEnd(nameWidth)}  ${'baseline (hz)'.padStart(12)}  ${'current (hz)'.padStart(12)}  ${'change'.padStart(7)}  ${'threshold'.padStart(9)}  status`
const rule = '-'.repeat(header.length)

console.log(`\ncomparing:\n  baseline: ${baselinePath}\n  current:  ${currentPath}`)
console.log(`floor threshold: ${(floorThreshold * 100).toFixed(0)}%  rme multiplier: ${rmeMultiplier}×\n`)
console.log(header)
console.log(rule)

for (const r of rows) {
    const flag =
        r.status === 'REGRESS'
            ? '  ← REGRESSION'
            : r.status === 'new'
              ? '  (new)'
              : ''
    const thresh = r.effectiveThreshold == null ? '        -' : `±${(r.effectiveThreshold * 100).toFixed(1)}%`.padStart(9)
    console.log(
        `${r.key.padEnd(nameWidth)}  ${fmtHz(r.baseHz)}  ${fmtHz(r.currHz)}  ${fmtPct(r.delta)}  ${thresh}  ${r.status}${flag}`
    )
}

console.log(rule)

if (regressions.length > 0) {
    console.error(`\n${regressions.length} regression${regressions.length === 1 ? '' : 's'} detected:\n`)
    for (const { key, delta, effectiveThreshold } of regressions) {
        console.error(`  ${key}  (${(delta * 100).toFixed(1)}%, threshold ±${(effectiveThreshold * 100).toFixed(1)}%)`)
    }
    console.error()
    process.exit(1)
} else {
    console.log(`\nall ${rows.filter((r) => r.status !== 'new').length} benchmarks within noise band.`)
    copyFileSync(currentPath, baselinePath)
    console.log(`baseline updated: ${baselinePath}\n`)
}
