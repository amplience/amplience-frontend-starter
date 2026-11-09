/**
 * Seeding products into their own repository (optional).
 *
 * A hub can keep products apart from pages and components — a separate
 * permission boundary, and a less crowded content repo. When
 * `AMPLIENCE_REPO_PRODUCTS` is set, the seed:
 *
 *  1. assigns the product content type to that repository as well as the
 *     content repo (`withProductsRepo`), and
 *  2. lifts product items out of the staged `pages` phase into a phase of
 *     their own that targets it (`moveProductItems`).
 *
 * Products are recognised by schema, not by folder, so a set that files them
 * somewhere other than `pages/products/` still splits correctly. Unset, none
 * of this runs and products seed into the content repo as they always have.
 */

import { mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync } from 'node:fs'
import path from 'node:path'

export const PRODUCT_SCHEMA = 'https://quadratic.amplience.com/v2/content/product'

/**
 * The content type with the products repository added to its assignments.
 *
 * Additive: the content repo stays assigned, because dc-cli's `--sync`
 * unassigns any repository *not* listed, and products already seeded there
 * must stay valid. Only the product type is touched.
 */
export const withProductsRepo = (contentType, repoName) => {
  if (!repoName || contentType?.contentTypeUri !== PRODUCT_SCHEMA) return contentType
  const repositories = contentType.repositories ?? []
  if (repositories.includes(repoName)) return contentType
  return { ...contentType, repositories: [...repositories, repoName] }
}

/**
 * Move every product item under `fromDir` into `toDir`, returning their ids.
 *
 * The relative path is kept so dc-cli recreates any folders — minus a leading
 * `products/`, which in a repository of nothing but products is noise.
 */
export const moveProductItems = (fromDir, toDir) => {
  const moved = []
  for (const entry of readdirSync(fromDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const file = path.join(entry.parentPath, entry.name)
    const item = JSON.parse(readFileSync(file, 'utf8'))
    if (item?.body?._meta?.schema !== PRODUCT_SCHEMA) continue

    const segments = path.relative(fromDir, file).split(path.sep)
    if (segments.length > 1 && segments[0] === 'products') segments.shift()
    const target = path.join(toDir, ...segments)
    mkdirSync(path.dirname(target), { recursive: true })
    renameSync(file, target)
    moved.push(item.id)
  }
  if (moved.length > 0) pruneEmptyDirs(fromDir)
  return moved
}

/** Remove folders under `dir` (not `dir` itself) that the move left empty. */
const pruneEmptyDirs = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const sub = path.join(dir, entry.name)
    pruneEmptyDirs(sub)
    if (readdirSync(sub).length === 0) rmdirSync(sub)
  }
}

/**
 * Which of these fixture ids the hub's import map already holds.
 *
 * dc-cli updates a mapped item where it already lives, so a product seeded
 * into the content repo before a products repo was configured stays there.
 * Knowing which ones lets the seed say so instead of appearing to ignore the
 * setting.
 */
export const alreadyMapped = (ids, map) => {
  const sources = new Set((map?.contentItems ?? []).map(([from]) => from))
  return ids.filter((id) => sources.has(id))
}
