export function stringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`

  const keys = Object.keys(obj).sort()
  return `{${keys.map(k => JSON.stringify(k) + ':' + stringify(obj[k])).join(',')}}`
}
