#!/usr/bin/env node
// Merge multiple vitest benchmark JSON runs into one by taking the median hz
// (and median rme) per benchmark. This smooths out single-run scheduler noise.
//
// Usage:
//   node perf/merge.js run1.json run2.json [run3.json ...] > merged.json

import { readFileSync } from 'node:fs'

const files = process.argv.slice(2)
if (files.length < 2) {
    console.error('usage: merge.js run1.json run2.json [run3.json ...]')
    process.exit(1)
}

const reports = files.map((f) => JSON.parse(readFileSync(f, 'utf8')))

function median(values) {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Build a flat map of name → [bench across runs] for each report
function flatBenchmarks(report) {
    const map = new Map()
    for (const file of report.files) {
        for (const group of file.groups) {
            for (const bench of group.benchmarks) {
                const key = `${group.fullName} > ${bench.name}`
                map.set(key, bench)
            }
        }
    }
    return map
}

const maps = reports.map(flatBenchmarks)

// Use first report as the structural template, overwrite hz/rme with medians
const merged = JSON.parse(JSON.stringify(reports[0]))

for (const file of merged.files) {
    for (const group of file.groups) {
        for (const bench of group.benchmarks) {
            const key = `${group.fullName} > ${bench.name}`
            const allHz = maps.map((m) => m.get(key)?.hz).filter((v) => v != null)
            const allRme = maps.map((m) => m.get(key)?.rme).filter((v) => v != null)
            if (allHz.length > 0) bench.hz = median(allHz)
            if (allRme.length > 0) bench.rme = median(allRme)
        }
    }
}

process.stdout.write(JSON.stringify(merged, null, 4) + '\n')
