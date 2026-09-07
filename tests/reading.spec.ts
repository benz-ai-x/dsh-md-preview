/**
 * The reading record (#25): a versioned, validated, bounded per-(session,
 * path) store over an injectable storage backend, plus the pure restore
 * resolution — stored section identity → in-range fallbacks, never an
 * error. No DOM here; the panel adapter lives in the jsdom suite.
 */

import { describe, expect, it } from 'vitest'
import {
  MAX_READING_RECORDS,
  READING_RECORD_VERSION,
  createMemoryStorage,
  createReadingStore,
  resolveRestoreTarget,
} from '../src/client/reading.ts'
import { extractOutline } from '../src/client/outline.ts'
import type { ReadingPosition } from '../src/client/reading.ts'

/** A position standing in the second "Section" of a three-section document. */
const IN_SECTION: ReadingPosition = {
  at: 1000,
  anchor: { text: 'Section', ordinal: 1 },
  index: 2,
  offsetIntoSection: 40,
  fraction: 0.5,
}

describe('createReadingStore', () => {
  it('records and returns a position for one document', () => {
    const store = createReadingStore(createMemoryStorage())
    store.record('s1', 'report.md', IN_SECTION)
    expect(store.get('s1', 'report.md')).toEqual(IN_SECTION)
  })

  it('never crosses sessions sharing the same path', () => {
    const store = createReadingStore(createMemoryStorage())
    store.record('s1', 'report.md', IN_SECTION)
    expect(store.get('s2', 'report.md')).toBeNull()
    store.record('s2', 'report.md', { ...IN_SECTION, at: 2000, fraction: 0.9 })
    // The existing record of s1 survives the s2 write untouched.
    expect(store.get('s1', 'report.md')?.fraction).toBe(0.5)
    expect(store.get('s2', 'report.md')?.fraction).toBe(0.9)
  })

  it('overwrites with the latest position for the same document', () => {
    const store = createReadingStore(createMemoryStorage())
    store.record('s1', 'report.md', IN_SECTION)
    const later: ReadingPosition = { ...IN_SECTION, at: 5000, fraction: 0.8 }
    store.record('s1', 'report.md', later)
    expect(store.get('s1', 'report.md')).toEqual(later)
  })

  it('persists a versioned envelope through the storage backend', () => {
    const storage = createMemoryStorage()
    const store = createReadingStore(storage)
    store.record('s1', 'report.md', IN_SECTION)
    const raw = storage.getItem('dsh-md-preview.reading.v1')
    expect(raw).toBeTruthy()
    const envelope = JSON.parse(raw!) as { version: number; records: unknown[] }
    expect(envelope.version).toBe(READING_RECORD_VERSION)
    expect(envelope.records).toHaveLength(1)
    // Path and position survive; never a document body or fingerprint.
    const entry = envelope.records[0] as { sessionId: string; path: string; position: ReadingPosition }
    expect(entry.sessionId).toBe('s1')
    expect(entry.path).toBe('report.md')
    expect(entry.position.fraction).toBe(0.5)
    expect(JSON.stringify(envelope)).not.toContain('fingerprint')
  })

  it('reads a store another instance wrote (same-browser revisit)', () => {
    const storage = createMemoryStorage()
    createReadingStore(storage).record('s1', 'report.md', IN_SECTION)
    expect(createReadingStore(storage).get('s1', 'report.md')).toEqual(IN_SECTION)
  })

  it('opens empty on a damaged envelope instead of failing', () => {
    const storage = createMemoryStorage()
    storage.setItem('dsh-md-preview.reading.v1', '{not json at all')
    const store = createReadingStore(storage)
    expect(store.get('s1', 'report.md')).toBeNull()
    // The damaged envelope is replaced by a working one on the next write.
    store.record('s1', 'report.md', IN_SECTION)
    expect(store.get('s1', 'report.md')).toEqual(IN_SECTION)
  })

  it('discards an envelope from an unknown format version', () => {
    const storage = createMemoryStorage()
    storage.setItem('dsh-md-preview.reading.v1', JSON.stringify({
      version: READING_RECORD_VERSION + 7,
      records: [{ sessionId: 's1', path: 'report.md', position: IN_SECTION }],
    }))
    expect(createReadingStore(storage).get('s1', 'report.md')).toBeNull()
  })

  it('drops individually invalid records but keeps the valid ones', () => {
    const storage = createMemoryStorage()
    storage.setItem('dsh-md-preview.reading.v1', JSON.stringify({
      version: READING_RECORD_VERSION,
      records: [
        { sessionId: 's1', path: 'broken.md', position: { at: 'yesterday', fraction: 'half' } },
        { sessionId: 's1', path: 'no-anchor.md', position: { ...IN_SECTION, anchor: { text: '', ordinal: -3 } } },
        { sessionId: 's1', path: 'bad-fraction.md', position: { ...IN_SECTION, fraction: 7.5 } },
        { sessionId: 's1', path: 'ok.md', position: IN_SECTION },
      ],
    }))
    const store = createReadingStore(storage)
    expect(store.get('s1', 'broken.md')).toBeNull()
    expect(store.get('s1', 'no-anchor.md')).toBeNull()
    expect(store.get('s1', 'bad-fraction.md')).toBeNull()
    expect(store.get('s1', 'ok.md')).toEqual(IN_SECTION)
  })

  it('treats an absent envelope as no record (first open)', () => {
    const store = createReadingStore(createMemoryStorage())
    expect(store.get('s1', 'report.md')).toBeNull()
  })

  it('keeps working when the storage throws on read', () => {
    const store = createReadingStore({
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => {},
    })
    expect(store.get('s1', 'report.md')).toBeNull()
    store.record('s1', 'report.md', IN_SECTION)
    // The in-memory copy still serves the app session.
    expect(store.get('s1', 'report.md')).toEqual(IN_SECTION)
  })

  it('keeps the in-memory record when the storage throws on write', () => {
    const store = createReadingStore({
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError') },
    })
    store.record('s1', 'report.md', IN_SECTION)
    expect(store.get('s1', 'report.md')).toEqual(IN_SECTION)
  })

  it('evicts the oldest records beyond the bound', () => {
    const store = createReadingStore(createMemoryStorage())
    for (let i = 0; i < MAX_READING_RECORDS + 10; i += 1) {
      store.record('s1', `doc-${String(i).padStart(3, '0')}.md`, { ...IN_SECTION, at: i })
    }
    // The ten oldest are gone; the newest all survive.
    expect(store.get('s1', 'doc-000.md')).toBeNull()
    expect(store.get('s1', 'doc-009.md')).toBeNull()
    expect(store.get('s1', `doc-${String(MAX_READING_RECORDS + 9).padStart(3, '0')}.md`)).toEqual({
      ...IN_SECTION,
      at: MAX_READING_RECORDS + 9,
    })
  })

  it('names the most recent document of one session for continue-reading', () => {
    const store = createReadingStore(createMemoryStorage())
    expect(store.latest('s1')).toBeNull()
    store.record('s1', 'older.md', { ...IN_SECTION, at: 1000 })
    store.record('s1', 'newer.md', { ...IN_SECTION, at: 2000 })
    store.record('s2', 'elsewhere.md', { ...IN_SECTION, at: 3000 })
    expect(store.latest('s1')).toEqual({ path: 'newer.md', at: 2000 })
    expect(store.latest('s2')).toEqual({ path: 'elsewhere.md', at: 3000 })
    // Recording again refreshes the session's latest.
    store.record('s1', 'older.md', { ...IN_SECTION, at: 4000 })
    expect(store.latest('s1')).toEqual({ path: 'older.md', at: 4000 })
  })

  it('lists a session\'s recent documents, recency-first, deduped, and bounded (#31)', () => {
    const store = createReadingStore(createMemoryStorage())
    expect(store.recent('s1', 3)).toEqual([])
    store.record('s1', 'a.md', { ...IN_SECTION, at: 1000 })
    store.record('s1', 'b.md', { ...IN_SECTION, at: 2000 })
    store.record('s1', 'c.md', { ...IN_SECTION, at: 3000 })
    store.record('s2', 'other.md', { ...IN_SECTION, at: 4000 })
    // Recency order for the owning session only; other sessions never leak.
    expect(store.recent('s1', 3)).toEqual([
      { path: 'c.md', at: 3000 },
      { path: 'b.md', at: 2000 },
      { path: 'a.md', at: 1000 },
    ])
    // The limit takes the most recent slice.
    expect(store.recent('s1', 1)).toEqual([{ path: 'c.md', at: 3000 }])
    expect(store.recent('s2', 5)).toEqual([{ path: 'other.md', at: 4000 }])
    // Re-reading a document moves it up as one entry, never a duplicate.
    store.record('s1', 'a.md', { ...IN_SECTION, at: 5000 })
    expect(store.recent('s1', 3)).toEqual([
      { path: 'a.md', at: 5000 },
      { path: 'c.md', at: 3000 },
      { path: 'b.md', at: 2000 },
    ])
  })
})

describe('resolveRestoreTarget', () => {
  const OUTLINE = extractOutline('# Top\n\n## Section\n\na\n\n## Middle\n\nb\n\n## Section\n\nc\n\n## Tail\n')
  // Two headings spell "Section"; ordinal tells them apart.
  const SECTION_ENTRIES = [1, 3]

  it('resolves the stored section by text and occurrence ordinal', () => {
    const target = resolveRestoreTarget(IN_SECTION, OUTLINE)
    expect(target).toEqual({ kind: 'section', index: SECTION_ENTRIES[1], offsetIntoSection: 40 })
  })

  it('resolves the first occurrence when the ordinal says so', () => {
    const target = resolveRestoreTarget({ ...IN_SECTION, anchor: { text: 'Section', ordinal: 0 } }, OUTLINE)
    expect(target).toEqual({ kind: 'section', index: SECTION_ENTRIES[0], offsetIntoSection: 40 })
  })

  it('falls back to the stored outline index when the heading text vanished', () => {
    const outline = extractOutline('# Top\n\n## Alpha\n\n## Beta\n\n## Gamma\n')
    const target = resolveRestoreTarget({ ...IN_SECTION, index: 2 }, outline)
    expect(target).toEqual({ kind: 'section', index: 2, offsetIntoSection: 40 })
  })

  it('falls back to the scroll fraction when the stored index left the valid range', () => {
    // The document shrank below the stored outline position: an index clamp
    // would invent a section; the fraction stays proportionally honest.
    const target = resolveRestoreTarget({ ...IN_SECTION, index: 9 }, extractOutline('# Top\n\n## Only\n'))
    expect(target).toEqual({ kind: 'fraction', fraction: 0.5 })
  })

  it('falls back to the scroll fraction when no section survives', () => {
    const target = resolveRestoreTarget({ ...IN_SECTION, index: 9 }, extractOutline('# Plain\n'))
    expect(target).toEqual({ kind: 'fraction', fraction: 0.5 })
  })

  it('starts from the top when nothing survives', () => {
    expect(resolveRestoreTarget({ ...IN_SECTION, index: 9, fraction: 0 }, [])).toEqual({ kind: 'top' })
    expect(resolveRestoreTarget({ ...IN_SECTION, anchor: null, index: -1, fraction: 0 }, OUTLINE).kind).toBe('top')
  })

  it('uses the fraction for a headingless document', () => {
    const target = resolveRestoreTarget({ ...IN_SECTION, anchor: null }, [])
    expect(target).toEqual({ kind: 'fraction', fraction: 0.5 })
  })
})
