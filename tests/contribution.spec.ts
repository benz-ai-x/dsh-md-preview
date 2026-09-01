/** Remote contribution invariants: descriptor shape and codec round-trips. */

import { describe, expect, it } from 'vitest'
import { isTypertRemoteSegment } from '@deepseek-ai/dsh-typert-protocol'
import { TYPERT_REMOTE } from '../src/typert/remote-client.ts'

const [descriptor, writeDescriptor] = TYPERT_REMOTE.descriptors
if (descriptor === undefined) throw new Error('contribution must carry the read descriptor')
if (writeDescriptor === undefined) throw new Error('contribution must carry the write descriptor')

describe('TYPERT_REMOTE', () => {
  it('names this package and its read and write methods', () => {
    expect(TYPERT_REMOTE.package).toBe('@benz-ai-x/dsh-md-preview')
    expect(TYPERT_REMOTE.descriptors).toHaveLength(2)
    expect(descriptor.method).toBe('read')
    expect(writeDescriptor.method).toBe('write')
    expect(descriptor.mode).toBeUndefined()
    expect(writeDescriptor.mode).toBeUndefined()
  })

  it('carries wire-legal segments', () => {
    for (const item of TYPERT_REMOTE.descriptors) {
      expect(isTypertRemoteSegment(item.namespace)).toBe(true)
      expect(isTypertRemoteSegment(item.method)).toBe(true)
    }
    expect(descriptor.id).toBe('@benz-ai-x/dsh-md-preview#mdPreview/read')
    expect(writeDescriptor.id).toBe('@benz-ai-x/dsh-md-preview#mdPreview/write')
    expect(descriptor.service).toBe('mdPreview')
    expect(writeDescriptor.service).toBe('mdPreview')
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
    expect(schema?.parse({ path: 'README.md', content: '# Hi', fingerprint: 'v1' }))
      .toEqual({ path: 'README.md', content: '# Hi', fingerprint: 'v1' })
    expect(() => schema?.parse({ path: 'README.md' })).toThrow()
    expect(() => schema?.parse(null)).toThrow()
  })

  it('refuses empty paths at the wire boundary', () => {
    const path = descriptor.parameters[1]
    expect(path?.name).toBe('path')
    expect(() => path?.codec.mode === 'strict' ? path.codec.schema.parse('') : undefined).toThrow()
  })

  it('takes the write guard as explicit trailing business arguments', () => {
    expect(writeDescriptor.invocation).toEqual({ kind: 'direct' })
    expect(writeDescriptor.scope).toBeUndefined()
    expect(writeDescriptor.parameters.map(parameter => parameter.wire))
      .toEqual(['sessionId', 'path', 'content', 'fingerprint', 'force'])
  })

  it('declares write cancellation and a strict result codec', () => {
    expect(writeDescriptor.cancellation).toEqual({ parameter: 'signal' })
    expect(writeDescriptor.result.mode).toBe('strict')
  })

  it('round-trips the write codecs', () => {
    const byName = new Map(writeDescriptor.parameters.map(parameter => [parameter.name, parameter]))
    const codec = (name: string) => {
      const parameter = byName.get(name)
      return parameter?.codec.mode === 'strict' ? parameter.codec.schema : undefined
    }
    expect(codec('sessionId')?.parse('session-1')).toBe('session-1')
    expect(codec('path')?.parse('README.md')).toBe('README.md')
    expect(() => codec('path')?.parse('')).toThrow()
    expect(codec('content')?.parse('')).toBe('')
    expect(codec('content')?.parse('# Edited\n')).toBe('# Edited\n')
    expect(codec('fingerprint')?.parse(undefined)).toBeUndefined()
    expect(codec('fingerprint')?.parse('v1')).toBe('v1')
    expect(codec('force')?.parse(undefined)).toBeUndefined()
    expect(codec('force')?.parse(true)).toBe(true)
    const result = writeDescriptor.result.mode === 'strict' ? writeDescriptor.result.schema : undefined
    expect(result?.parse({ path: 'README.md', fingerprint: 'v2' })).toEqual({ path: 'README.md', fingerprint: 'v2' })
    expect(() => result?.parse({ path: 'README.md' })).toThrow()
  })
})
