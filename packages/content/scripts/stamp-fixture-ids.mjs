#!/usr/bin/env node
/**
 * `pnpm fixtures:ids` — stamp every fixture's id from its set and path, and
 * rewrite every reference to the ids that changed (ADR-0019).
 *
 * Ids are derived (see lib/fixture-id.mjs), so this script is the thing that
 * makes the derivation true on disk. It is idempotent: once stamped, the
 * old→new map is the identity and nothing is written.
 *
 * Fixtures reference each other by literal id — content-links, `_meta.deliveryId`,
 * and the hierarchy manifest's root/children — so re-minting is a two-pass job.
 * Pass one reads every current id and computes its replacement; pass two rewrites
 * every file against that one complete map. Because the map is built entirely
 * before anything is written, no file is ever rewritten against a half-updated
 * view.
 *
 * A fixture rename therefore changes its id, which on the next seed creates a
 * new hub item and orphans the old one — treat it as a content migration.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixtureIdFor } from './lib/fixture-id.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const fixturesRoot = path.join(here, '..', 'fixtures')

/** Directories inside a set that hold content items, in seed order. */
const ITEM_DIRS = ['components', 'slots', 'pages', 'site-components']

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

/** Every `*.json` under `dir`, recursively, as paths relative to `from`. */
const jsonFilesUnder = (dir, from) => {
  let out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out // an optional phase directory this set doesn't use
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out = out.concat(jsonFilesUnder(abs, from))
    else if (entry.name.endsWith('.json')) out.push(path.relative(from, abs))
  }
  return out
}

/** The fixture sets on disk — a directory is a set when it holds a `set.json`. */
const fixtureSets = () =>
  readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      try {
        return statSync(path.join(fixturesRoot, name, 'set.json')).isFile()
      } catch {
        return false
      }
    })
    .sort()

/** Replace any string anywhere in `node` that the map knows about. */
const remap = (node, map) => {
  if (typeof node === 'string') return map.get(node) ?? node
  if (Array.isArray(node)) return node.map((child) => remap(child, map))
  if (node !== null && typeof node === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      // Hierarchy manifests key their children map BY id, so keys move too.
      out[map.get(key) ?? key] = remap(value, map)
    }
    return out
  }
  return node
}

let changedFiles = 0
let checkedFiles = 0
const written = []

for (const setName of fixtureSets()) {
  const setDir = path.join(fixturesRoot, setName)
  const itemFiles = ITEM_DIRS.flatMap((dir) => jsonFilesUnder(path.join(setDir, dir), setDir))

  // Pass one — every current id, and what it becomes.
  const map = new Map()
  const newIds = new Set()
  for (const rel of itemFiles) {
    const item = readJson(path.join(setDir, rel))
    const next = fixtureIdFor(setName, rel)
    if (newIds.has(next)) {
      throw new Error(`Two fixtures in "${setName}" derive the same id (${next}) — from ${rel}.`)
    }
    newIds.add(next)
    if (typeof item.id === 'string' && item.id !== next) map.set(item.id, next)
  }

  // An id that is both somebody's old id and somebody else's new one would make
  // a single remap pass ambiguous. Astronomically unlikely; loud if it happens.
  for (const old of map.keys()) {
    if (newIds.has(old) && map.get(old) !== old) {
      throw new Error(
        `Id ${old} in "${setName}" is both an existing id and a newly derived one — ` +
          'stamping would be ambiguous. Rename the fixture that derives it.',
      )
    }
  }

  // Pass two — rewrite ids and every reference to them, across the whole set.
  const allFiles = [...itemFiles, ...jsonFilesUnder(path.join(setDir, '_hierarchy'), setDir)]
  for (const rel of allFiles) {
    const abs = path.join(setDir, rel)
    const item = readJson(abs)
    const remapped = remap(item, map)
    if (itemFiles.includes(rel)) remapped.id = fixtureIdFor(setName, rel)
    checkedFiles++
    // Compare the data, not the text: these files are prettier-formatted on
    // disk and `JSON.stringify` expands short arrays, so a text comparison
    // would rewrite half the tree on every run and never settle.
    if (JSON.stringify(remapped) !== JSON.stringify(item)) {
      writeJson(abs, remapped)
      written.push(abs)
      changedFiles++
    }
  }

  console.log(`${setName}: ${itemFiles.length} items, ${map.size} id(s) re-minted`)
}

// `JSON.stringify` expands short arrays that prettier keeps on one line, so
// format what we touched — same best-effort pass the docs generator runs, and
// what keeps `format:check` green.
if (written.length > 0) {
  const prettierBin = path.join(repoRoot, 'node_modules/.bin/prettier')
  if (existsSync(prettierBin)) {
    spawnSync(prettierBin, ['--write', '--log-level', 'warn', ...written], { stdio: 'inherit' })
  } else {
    console.warn('! prettier not found — run `pnpm format` before committing')
  }
}

console.log(
  changedFiles === 0
    ? `✓ ${checkedFiles} fixture files already carry derived ids`
    : `✓ rewrote ${changedFiles} of ${checkedFiles} fixture files`,
)
