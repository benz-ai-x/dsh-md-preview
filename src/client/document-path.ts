/** Display-only paths. Opening, saving and reading records keep the original identity. */

/** Remove the owning session's known workspace prefix, never an inferred root. */
export function workspaceDisplayPath(path: string, workspaceRoot?: string): string {
  if (!workspaceRoot) return path
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalized = path.replace(/\\/g, '/')
  if (root === '' && /^\/+$/u.test(workspaceRoot)) return normalized.startsWith('/') ? normalized.slice(1) : path
  if (!root || !normalized.startsWith(`${root}/`)) return path
  return normalized.slice(root.length + 1)
}

/** Parent context without repeating the document name on the second line. */
export function documentParent(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const split = normalized.lastIndexOf('/')
  return split < 0 ? '.' : normalized.slice(0, split) || '/'
}
