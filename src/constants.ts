/** Schema-free deployment constants shared by Host config and browser face. */

/** Universal default: 1 MiB keeps a preview read bounded for any deployment. */
export const DEFAULT_MAX_BYTES = 1_048_576

/** Supported Markdown editing vocabulary; configuration may narrow it. */
export const DEFAULT_ALLOWED_EXTENSIONS = ['.md', '.markdown'] as const

/** Legacy previewExtensions default retained for existing profile compatibility. */
export const DEFAULT_PREVIEW_EXTENSIONS = ['.md', '.markdown', '.txt'] as const

/** Default search result cap: far above real agent-workspace document counts
 * (tens to low hundreds observed in DSH sessions) while bounding one answer. */
export const DEFAULT_SEARCH_MAX_RESULTS = 200

/** Default search traversal cap in directories: bounded for any deployment
 * workspace; a pathological tree reports `traversal-limit`, never hangs. */
export const DEFAULT_SEARCH_MAX_DIRECTORIES = 2000

/** Default parallel `listDir` width for one search. */
export const DEFAULT_SEARCH_CONCURRENCY = 8
