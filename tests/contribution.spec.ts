/** Remote contribution invariants: descriptor shape and codec round-trips. */

import { describe, expect, it } from 'vitest'
import { isTypertRemoteSegment } from '@deepseek-ai/dsh-typert-protocol'
import { TYPERT_REMOTE } from '../src/typert/remote-client.ts'

const [descriptor] = TYPERT_REMOTE.descriptors
if (descriptor === undefined) throw new Error('contribution must carry the read descriptor')

describe('TYPERT_REMOTE', () => {
  it('names this package and exactly one read method', () => {
    expect(TYPERT_REMOTE.package).toBe('dsh-md-preview')
    expect(TYPERT_REMOTE.descriptors).toHaveLength(1)
    expect(descriptor.method).toBe('read')
    expect(descriptor.mode).toBeUndefined()
  })

  it('carries wire-legal segments', () => {
    expect(isTypertRemoteSegment(descriptor.namespace)).toBe(true)
    expect(isTypertRemoteSegment(descriptor.method)).toBe(true)
    expect(descriptor.id).toBe('dsh-md-preview#mdPreview/read')
    expect(descriptor.service).toBe('mdPreview')
  })

  it('takes the session identity as an explicit first business argument', () => {
    expect(descriptor.invocation).toEqual({ kind: 'direct' })
    expect(descriptor.scope).toBeUndefined()
    expect(descriptor.parameters.map(parameter => parameter.wire)).toEqual(['sessionId', 'path'])
    expect(descriptor.parameters.every(parameter => parameter.source === 'json')).toBe(true)
  })

  it('declares transport cancellation and a strict result codec', () => {
    expect(descriptor.cancellation).toEqual({ parameter: 'signal' })
    expect(descriptor.result.mode).toBe('strict')
  })

  it('round-trips the result codec', () => {
    const schema = descriptor.result.mode === 'strict' ? descriptor.result.schema : undefined
    expect(schema?.parse({ path: 'README.md', content: '# Hi' }))
      .toEqual({ path: 'README.md', content: '# Hi' })
    expect(() => schema?.parse({ path: 'README.md' })).toThrow()
    expect(() => schema?.parse(null)).toThrow()
  })

  it('refuses empty paths at the wire boundary', () => {
    const path = descriptor.parameters[1]
    expect(path?.name).toBe('path')
    expect(() => path?.codec.mode === 'strict' ? path.codec.schema.parse('') : undefined).toThrow()
  })
})
