/** Deployment configuration for the MdPreview Host service. */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_BYTES, DEFAULT_PREVIEW_EXTENSIONS } from './constants.ts'

/** Runtime-validated MdPreview configuration. */
export interface Config {
  /** Largest file size the service will read and return, in bytes. */
  maxBytes: number
  /** Extensions (lowercased, dot-prefixed) eligible for editing. */
  allowedExtensions: string[]
  /** Extensions (lowercased, dot-prefixed) eligible for preview (a superset
   * of the editable set — plain-text members render but never edit). */
  previewExtensions: string[]
}

/** Standard Schema twin of {@link Config}; defaults live here, not in code. */
export const Config: z<Config> = z.object({
  maxBytes: z.number().min(1).default(DEFAULT_MAX_BYTES),
  allowedExtensions: z.array(z.string()).default([...DEFAULT_ALLOWED_EXTENSIONS]),
  previewExtensions: z.array(z.string()).default([...DEFAULT_PREVIEW_EXTENSIONS]),
})
