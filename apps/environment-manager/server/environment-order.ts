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
