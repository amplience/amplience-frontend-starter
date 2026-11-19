/**
 * Hubs in the requested order. Unknown names are ignored; hubs missing from the
 * request (e.g. added meanwhile) keep their relative order at the end.
 */
export function applyOrder<T extends { name: string }>(envs: T[], names: string[]): T[] {
  const byName = new Map(envs.map((env) => [env.name, env]))
  const requested = [...new Set(names)].flatMap((name) => {
    const env = byName.get(name)
    return env === undefined ? [] : [env]
  })
  const listed = new Set(requested.map((env) => env.name))
  return [...requested, ...envs.filter((env) => !listed.has(env.name))]
}

/**
 * Moves every hub in group `from` to group `to`. A `to` that matches another
 * group ignoring case joins it under that group's spelling.
 */
export function renameGroup<T extends { group?: string }>(
  envs: T[],
  from: string,
  to: string,
): T[] {
  const source = from.trim()
  const target = to.trim()
  const existing = envs
    .map((env) => env.group?.trim())
    .find((g) => g !== undefined && g !== source && g.toLowerCase() === target.toLowerCase())
  const name = existing ?? target
  return envs.map((env) => (env.group?.trim() === source ? { ...env, group: name } : env))
}
