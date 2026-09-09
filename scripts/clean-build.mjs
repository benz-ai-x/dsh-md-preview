/** Retired source declarations must not survive into a later package. */
import { rmSync } from 'node:fs'
rmSync(new URL('../lib/', import.meta.url), { recursive: true, force: true })
