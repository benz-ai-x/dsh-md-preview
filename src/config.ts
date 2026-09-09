/** Deployment configuration for the MdPreview Host service. */

import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_ALLOWED_EXTENSIONS,
  DEFAULT_MAX_BYTES,
  DEFAULT_PREVIEW_EXTENSIONS,
  DEFAULT_SEARCH_CONCURRENCY,
  DEFAULT_SEARCH_MAX_DIRECTORIES,
  DEFAULT_SEARCH_MAX_RESULTS,
} from './constants.ts'

/** Runtime-validated MdPreview configuration. */
export interface Config {
  /** Largest file size the service will read and return, in bytes. */
  maxBytes: number
  /** Editing allowlist (lowercase, dot-prefixed), intersected with .md/.markdown. */
  allowedExtensions: string[]
  /** @deprecated Accepted for old profiles; no longer controls text admission. */
  previewExtensions: string[]
  /** Workspace search: most matches one answer returns (result bound). */
  searchMaxResults: number
  /** Workspace search: most directories one answer walks (traversal bound). */
  searchMaxDirectories: number
  /** Workspace search: parallel directory listings per traversal step. */
  searchConcurrency: number
}

/** Standard Schema twin of {@link Config}; defaults live here, not in code. */
export const Config: z<Config> = z.object({
  maxBytes: z.number().min(1).default(DEFAULT_MAX_BYTES),
  allowedExtensions: z.array(z.string()).default([...DEFAULT_ALLOWED_EXTENSIONS]),
  previewExtensions: z.array(z.string()).default([...DEFAULT_PREVIEW_EXTENSIONS]),
  searchMaxResults: z.number().min(1).default(DEFAULT_SEARCH_MAX_RESULTS),
  searchMaxDirectories: z.number().min(1).default(DEFAULT_SEARCH_MAX_DIRECTORIES),
  searchConcurrency: z.number().min(1).default(DEFAULT_SEARCH_CONCURRENCY),
})
