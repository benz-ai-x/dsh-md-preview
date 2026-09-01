/** Schema-free deployment constants shared by Host config and browser face. */

/** Universal default: 1 MiB keeps a preview read bounded for any deployment. */
export const DEFAULT_MAX_BYTES = 1_048_576

/** Markdown documents are the previewable vocabulary; deployments may widen it. */
export const DEFAULT_ALLOWED_EXTENSIONS = ['.md', '.markdown'] as const

/** The preview union: readable (and rendered) even though only markdown edits. */
export const DEFAULT_PREVIEW_EXTENSIONS = ['.md', '.markdown', '.txt'] as const
