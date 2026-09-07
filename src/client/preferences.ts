/**
 * The panel preference record (#26): what lets the reader's own reading
 * space survive closes and revisits. UI-local viewing preferences only —
 * the dragged panel width, the rail width, the rail collapse choice, and
 * the per-session files/outline choice; never file content, drafts, or
 * session facts. The envelope is versioned, every loaded value validated,
 * remembered sessions bounded, and every failing storage call degrades to
 * the in-memory copy — a first open never lands on a bogus zero width.
 */

import type { StorageLike } from './reading.ts'

/** Envelope format version; an unknown version means an old, unreadable record. */
export const PANEL_PREFERENCE_VERSION = 1

/** The storage key of the versioned envelope. */
const STORAGE_KEY = 'dsh-md-preview.prefs.v1'

/** Remembered sessions at most; the least recently touched evict first. */
const MAX_REMEMBERED_SESSIONS = 20

/** Panel width support range (the overlay's drag bounds). */
export const PANEL_MIN_WIDTH = 360
export const PANEL_MAX_WIDTH = 1200
export const PANEL_DEFAULT_WIDTH = 720

/** Rail width support range (the rail's drag bounds). */
export const RAIL_MIN_WIDTH = 120
export const RAIL_MAX_WIDTH = 320
export const RAIL_DEFAULT_WIDTH = 148

/** Which rail mini-tab the panel shows. */
export type RailTab = 'files' | 'outline'

/** The geometry facts a reader may have manually chosen (null = never chosen). */
export interface PanelGeometryPreferences {
  readonly panelWidth: number | null
  readonly railWidth: number | null
  readonly railCollapsed: boolean | null
}

/** The persisted envelope. */
interface PreferenceEnvelope {
  readonly version: number
  readonly panelWidth?: unknown
  readonly railWidth?: unknown
  readonly railCollapsed?: unknown
  readonly railTabs?: Record<string, { tab: unknown; at: unknown }>
}

/** The panel-facing preference store. */
export interface PanelPreferenceStore {
  /** The remembered geometry (validated; nulls where nothing valid lives). */
  geometry(): PanelGeometryPreferences
  /** Record one or more manual geometry choices (later values win per field). */
  recordGeometry(partial: Partial<PanelGeometryPreferences>): void
  /** The remembered files/outline choice of one session, or null. */
  railTab(sessionId: string): RailTab | null
  /** Record one session's files/outline choice. */
  recordRailTab(sessionId: string, tab: RailTab): void
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

const widthIn = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null

const isRailTab = (value: unknown): value is RailTab => value === 'files' || value === 'outline'

/** Parse the persisted envelope; anything unreadable yields an empty record. */
function parseEnvelope(raw: string | null): PreferenceEnvelope | null {
  if (raw === null || raw === '') return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const envelope = parsed as Record<string, unknown>
    if (envelope.version !== PANEL_PREFERENCE_VERSION) return null
    return parsed as PreferenceEnvelope
  } catch {
    return null
  }
}

/**
 * Create the panel preference store over one storage backend.
 * @param storage - the persistence face; failing calls degrade to memory.
 */
export function createPanelPreferenceStore(storage: StorageLike): PanelPreferenceStore {
  let memory: { geometry: PanelGeometryPreferences; railTabs: Map<string, { tab: RailTab; at: number }> } | null = null
  const load = (): NonNullable<typeof memory> => {
    if (memory !== null) return memory
    let envelope: PreferenceEnvelope | null = null
    try {
      envelope = parseEnvelope(storage.getItem(STORAGE_KEY))
    } catch {
      envelope = null
    }
    const railTabs = new Map<string, { tab: RailTab; at: number }>()
    if (envelope !== null) {
      for (const [sessionId, entry] of Object.entries(envelope.railTabs ?? {})) {
        if (sessionId.length === 0 || entry === null || typeof entry !== 'object') continue
        if (!isRailTab(entry.tab) || typeof entry.at !== 'number' || !Number.isFinite(entry.at)) continue
        railTabs.set(sessionId, { tab: entry.tab, at: entry.at })
      }
    }
    memory = {
      geometry: envelope === null
        ? { panelWidth: null, railWidth: null, railCollapsed: null }
        : {
          panelWidth: widthIn(envelope.panelWidth, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH),
          railWidth: widthIn(envelope.railWidth, RAIL_MIN_WIDTH, RAIL_MAX_WIDTH),
          railCollapsed: envelope.railCollapsed === true || envelope.railCollapsed === false ? envelope.railCollapsed : null,
        },
      railTabs,
    }
    return memory
  }
  const save = (state: NonNullable<typeof memory>): void => {
    memory = state
    const railTabs: Record<string, { tab: RailTab; at: number }> = {}
    for (const [sessionId, entry] of state.railTabs) railTabs[sessionId] = { tab: entry.tab, at: entry.at }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        version: PANEL_PREFERENCE_VERSION,
        panelWidth: state.geometry.panelWidth,
        railWidth: state.geometry.railWidth,
        railCollapsed: state.geometry.railCollapsed,
        railTabs,
      }))
    } catch {
      // Storage write failed; the in-memory copy (already set) carries on.
    }
  }
  return {
    geometry() {
      return load().geometry
    },
    recordGeometry(partial) {
      const state = load()
      save({
        geometry: {
          panelWidth: partial.panelWidth !== undefined ? partial.panelWidth : state.geometry.panelWidth,
          railWidth: partial.railWidth !== undefined ? partial.railWidth : state.geometry.railWidth,
          railCollapsed: partial.railCollapsed !== undefined ? partial.railCollapsed : state.geometry.railCollapsed,
        },
        railTabs: state.railTabs,
      })
    },
    railTab(sessionId) {
      return load().railTabs.get(sessionId)?.tab ?? null
    },
    recordRailTab(sessionId, tab) {
      const state = load()
      // 'files' is the default: choosing it back is nothing to remember.
      if (tab === 'files') state.railTabs.delete(sessionId)
      else state.railTabs.set(sessionId, { tab, at: Date.now() })
      // Bound the remembered sessions by recency of touch.
      while (state.railTabs.size > MAX_REMEMBERED_SESSIONS) {
        let oldest: { key: string; at: number } | null = null
        for (const [key, entry] of state.railTabs) {
          if (oldest === null || entry.at < oldest.at) oldest = { key, at: entry.at }
        }
        if (oldest === null) break
        state.railTabs.delete(oldest.key)
      }
      save(state)
    },
  }
}

/**
 * The width to open the panel at: the stored manual width when one exists,
 * else the default preset — both clamped into the support range and the
 * live viewport, so a shrunken screen never overflows and an absent value
 * never lands on a bogus minimum.
 * @param stored - the remembered manual width, or null when never chosen.
 * @param viewportWidth - the live viewport width (0 = unknown).
 */
export function clampPanelWidth(stored: number | null, viewportWidth: number): number {
  if (stored === null) {
    if (viewportWidth <= 0) return PANEL_DEFAULT_WIDTH
    return Math.min(PANEL_DEFAULT_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(viewportWidth / 2)))
  }
  const lower = Math.min(PANEL_MIN_WIDTH, viewportWidth > 0 ? viewportWidth : PANEL_MIN_WIDTH)
  const upper = Math.max(lower, Math.min(PANEL_MAX_WIDTH, viewportWidth > 0 ? viewportWidth : PANEL_MAX_WIDTH))
  return Math.min(upper, Math.max(lower, Math.round(stored)))
}

/**
 * The rail width to open at (the same treatment on the rail's own range).
 * @param stored - the remembered manual rail width, or null.
 */
export function clampRailWidth(stored: number | null): number {
  if (stored === null) return RAIL_DEFAULT_WIDTH
  return Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, Math.round(stored)))
}
