/** Deployment configuration for the MdPreview Host service. */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_BYTES } from './constants.ts'

/** Runtime-validated MdPreview configuration. */
export interface Config {
  /** Largest file size the service will read and return, in bytes. */
  maxBytes: number
  /** Extensions (lowercased, dot-prefixed) eligible for preview. */
  allowedExtensions: string[]
}

/** Standard Schema twin of {@link Config}; defaults live here, not in code. */
export const Config: z<Config> = z.object({
  maxBytes: z.number().min(1).default(DEFAULT_MAX_BYTES),
  allowedExtensions: z.array(z.string()).default([...DEFAULT_ALLOWED_EXTENSIONS]),
})
