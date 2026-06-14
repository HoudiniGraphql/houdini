#!/usr/bin/env node
// Merge N vitest benchmark JSON files into one by taking the median hz value
// for each benchmark. Used to reduce noise when running the suite multiple times.
//
// Usage:
//   node perf/merge.js <out.json> <run1.json> <run2.json> [run3.json ...]

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const [, , outArg, ...inputArgs] = process.argv

if (!outArg || inputArgs.length < 2) {
    console.error('Usage: node perf/merge.js <out.json> <run1.json> <run2.json> [run3.json ...]')
    process.exit(1)
}

const outPath = resolve(root, outArg)
const reports = inputArgs.map((p) => JSON.parse(readFileSync(resolve(root, p), 'utf8')))

function median(values) {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Use the first report as the structural template; patch hz with the median.
const merged = JSON.parse(JSON.stringify(reports[0]))

for (const file of merged.files) {
    for (const group of file.groups) {
        for (const bench of group.benchmarks) {
            const key = `${group.fullName} > ${bench.name}`
            const allHz = reports.flatMap((r) => {
                for (const f of r.files) {
                    for (const g of f.groups) {
                        if (`${g.fullName} > ` + bench.name === key) {
                            const match = g.benchmarks.find((b) => b.name === bench.name)
                            if (match) return [match.hz]
                        }
                    }
                }
                return []
            })
            if (allHz.length > 0) bench.hz = median(allHz)
        }
    }
}

writeFileSync(outPath, JSON.stringify(merged, null, 4))
console.log(`merged ${inputArgs.length} runs → ${outPath}`)
