/**
 * The reading record (#25): what lets a reopened document land back near
 * where reading stopped. UI-local viewing state only — keyed by (session,
 * path), holding nothing but position facts (section identity, offsets,
 * fractions, timestamps); never a document body, draft, or fingerprint.
 * The envelope is versioned, every loaded record is validated, and the
 * collection is bounded. Storage damage or absence degrades to an empty
 * (then in-memory) store — reading itself never depends on it.
 */

import type { OutlineEntry } from './outline.ts'
import { comparable, findHeadingElement } from './outline.ts'

/** The viewport's reading line: slightly below the container's top, so the first heading owns the very top. */
const READING_LINE_INSET = 24

/** Records kept at most; the oldest `at` evict first. */
export const MAX_READING_RECORDS = 50

/** Envelope format version; an unknown version means an unreadable store. */
export const READING_RECORD_VERSION = 1

/** The storage key of the versioned envelope. */
const STORAGE_KEY = 'dsh-md-preview.reading.v1'

/** The minimal persistence face the store needs (a subset of DOM Storage). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Section identity: the heading text plus its occurrence ordinal among same-text headings. */
export interface ReadingAnchor {
  readonly text: string
  readonly ordinal: number
}

/** One document's reading position, as captured from the view face. */
export interface ReadingPosition {
  /** Capture time (ms epoch); recency order and eviction key. */
  readonly at: number
  /** The section owning the reading line; null above the first heading. */
  readonly anchor: ReadingAnchor | null
  /** The anchor's outline index at capture time (in-range fallback). */
  readonly index: number
  /** Scroll offset below the anchor heading's top, in px. */
  readonly offsetIntoSection: number
  /** Scroll fraction 0..1 — the fallback that survives any outline change. */
  readonly fraction: number
}

/** One stored entry: composite identity plus its position. */
interface StoredReading {
  readonly sessionId: string
  readonly path: string
  readonly position: ReadingPosition
}

/** The panel-facing reading record store. */
export interface ReadingStore {
  /** The stored position of one document, or null without a usable record. */
  get(sessionId: string, path: string): ReadingPosition | null
  /** Record (or overwrite) one document's position. */
  record(sessionId: string, path: string, position: ReadingPosition): void
  /** The most recently read document of one session — the continue-reading target. */
  latest(sessionId: string): { readonly path: string; readonly at: number } | null
}

/** An in-memory StorageLike for tests and for browsers without storage. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
  }
}

/** The browser's localStorage when reachable, else null (memory fallback). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Whether a loaded position carries well-formed facts (structure, not truth). */
function isValidPosition(value: unknown): value is ReadingPosition {
  if (typeof value !== 'object' || value === null) return false
  const position = value as Record<string, unknown>
  const anchor = position.anchor as ReadingPosition['anchor'] | undefined
  const anchorOk = anchor === null || (typeof anchor === 'object' && anchor !== null
    && typeof anchor.text === 'string' && anchor.text.trim().length > 0
    && Number.isInteger(anchor.ordinal) && anchor.ordinal >= 0)
  return anchorOk
    && isFiniteNumber(position.at)
    && Number.isInteger(position.index)
    && isFiniteNumber(position.offsetIntoSection)
    && isFiniteNumber(position.fraction) && position.fraction >= 0 && position.fraction <= 1
}

/** Whether one loaded entry is well-formed enough to serve. */
function isValidEntry(value: unknown): value is StoredReading {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return typeof entry.sessionId === 'string' && entry.sessionId.length > 0
    && typeof entry.path === 'string' && entry.path.length > 0
    && isValidPosition(entry.position)
}

/** Parse the persisted envelope; anything unreadable yields no records. */
function parseEnvelope(raw: string | null): readonly StoredReading[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return []
  }
  if (typeof parsed !== 'object' || parsed === null) return []
  const envelope = parsed as Record<string, unknown>
  if (envelope.version !== READING_RECORD_VERSION || !Array.isArray(envelope.records)) return []
  return envelope.records.filter(isValidEntry)
}

/**
 * Create the reading record store over one storage backend.
 * @param storage - the persistence face; every failing call degrades the
 *   store to its in-memory copy for the rest of the session.
 */
export function createReadingStore(storage: StorageLike): ReadingStore {
  let memory: readonly StoredReading[] | null = null
  const load = (): readonly StoredReading[] => {
    if (memory !== null) return memory
    try {
      return parseEnvelope(storage.getItem(STORAGE_KEY))
    } catch {
      memory = []
      return memory
    }
  }
  const save = (records: readonly StoredReading[]): void => {
    memory = records
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: READING_RECORD_VERSION, records }))
    } catch {
      // Storage write failed; the in-memory copy (already set) carries on.
    }
  }
  return {
    get(sessionId, path) {
      const found = load().find(entry => entry.sessionId === sessionId && entry.path === path)
      return found?.position ?? null
    },
    record(sessionId, path, position) {
      const kept = load().filter(entry => !(entry.sessionId === sessionId && entry.path === path))
      const next = [{ sessionId, path, position }, ...kept]
        .sort((a, b) => b.position.at - a.position.at)
        .slice(0, MAX_READING_RECORDS)
      save(next)
    },
    latest(sessionId) {
      let best: StoredReading | undefined
      for (const entry of load()) {
        if (entry.sessionId !== sessionId) continue
        if (best === undefined || entry.position.at > best.position.at) best = entry
      }
      return best === undefined ? null : { path: best.path, at: best.position.at }
    },
  }
}

/** Where a stored position wants to land in the current document. */
export type RestoreTarget =
  | { readonly kind: 'section'; readonly index: number; readonly offsetIntoSection: number }
  | { readonly kind: 'fraction'; readonly fraction: number }
  | { readonly kind: 'top' }

/**
 * Resolve the restore plan for a stored position against the fresh outline.
 * The chain: the stored section by text and ordinal → the stored outline
 * index while it stays inside the valid range → the scroll fraction → the
 * top. Resolution never fails; the caller always gets a place to be.
 */
export function resolveRestoreTarget(position: ReadingPosition, outline: readonly OutlineEntry[]): RestoreTarget {
  const anchor = position.anchor
  if (anchor !== null) {
    let ordinal = 0
    for (let index = 0; index < outline.length; index += 1) {
      const entry = outline[index] as OutlineEntry
      if (comparable(entry.text) !== comparable(anchor.text)) continue
      if (ordinal === anchor.ordinal) {
        return { kind: 'section', index, offsetIntoSection: position.offsetIntoSection }
      }
      ordinal += 1
    }
  }
  if (position.index >= 0 && position.index < outline.length) {
    return { kind: 'section', index: position.index, offsetIntoSection: position.offsetIntoSection }
  }
  if (position.fraction > 0) return { kind: 'fraction', fraction: position.fraction }
  return { kind: 'top' }
}

/**
 * Capture the view face's current reading position from the rendered DOM.
 * Mirrors the outline tracker's geometry: the reading line sits `inset`
 * below the container top, and heading offsets are document coordinates.
 * @returns the position, or null when the container carries no layout.
 */
export function captureViewPosition(
  container: HTMLElement,
  outline: readonly OutlineEntry[],
  at: number,
): ReadingPosition | null {
  const scrollTop = container.scrollTop
  const scrollable = container.scrollHeight - container.clientHeight
  const fraction = scrollable > 0 ? Math.min(1, Math.max(0, scrollTop / scrollable)) : 0
  const base = container.getBoundingClientRect().top - scrollTop
  let active = -1
  let anchor: ReadingAnchor | null = null
  let offsetIntoSection = 0
  for (let index = 0; index < outline.length; index += 1) {
    const heading = findHeadingElement(container, outline, index)
    if (heading === undefined) continue
    const top = heading.getBoundingClientRect().top - base
    if (top > scrollTop + READING_LINE_INSET) break
    active = index
    const text = (outline[index] as OutlineEntry).text
    let ordinal = 0
    for (let prior = 0; prior < index; prior += 1) {
      if (comparable((outline[prior] as OutlineEntry).text) === comparable(text)) ordinal += 1
    }
    anchor = { text, ordinal }
    offsetIntoSection = scrollTop - top
  }
  return { at, anchor, index: active, offsetIntoSection, fraction }
}

/**
 * Apply one stored position to the rendered document: scroll once to the
 * resolved target, degrading exactly as the resolution prescribes. The
 * assignment is the whole effect — no smooth scrolling, no re-application.
 * @returns whether a scroll was applied.
 */
export function applyReadingPosition(
  container: HTMLElement,
  outline: readonly OutlineEntry[],
  position: ReadingPosition,
): boolean {
  const target = resolveRestoreTarget(position, outline)
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
  const setScroll = (value: number): void => {
    container.scrollTop = Math.min(maxScroll, Math.max(0, Math.round(value)))
  }
  if (target.kind === 'section') {
    const heading = findHeadingElement(container, outline, target.index)
    if (heading !== undefined) {
      const base = container.getBoundingClientRect().top - container.scrollTop
      setScroll(heading.getBoundingClientRect().top - base + target.offsetIntoSection)
      return true
    }
    // The outline knows the section but the rendered DOM does not spell it:
    // degrade to the stored fraction, then the top.
    setScroll(position.fraction * maxScroll)
    return true
  }
  if (target.kind === 'fraction') {
    setScroll(target.fraction * maxScroll)
    return true
  }
  setScroll(0)
  return true
}
