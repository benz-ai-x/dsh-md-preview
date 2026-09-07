/**
 * The panel preference record (#26): a versioned, validated store over an
 * injectable backend holding only UI-local viewing preferences — panel
 * width, rail width, rail collapse, and the per-session files/outline
 * choice. Empty, invalid, foreign-version, and hostile-storage inputs all
 * degrade to defaults; restored widths clamp to the current viewport.
 */

import { describe, expect, it } from 'vitest'
import {
  PANEL_PREFERENCE_VERSION,
  clampPanelWidth,
  clampRailWidth,
  createMemoryStorage,
  createPanelPreferenceStore,
} from '../src/client/preferences.ts'

describe('createPanelPreferenceStore', () => {
  it('records and restores manual geometry across instances (same browser)', () => {
    const storage = createMemoryStorage()
    const first = createPanelPreferenceStore(storage)
    first.recordGeometry({ panelWidth: 505, railWidth: 201, railCollapsed: true })
    expect(createPanelPreferenceStore(storage).geometry()).toEqual({
      panelWidth: 505, railWidth: 201, railCollapsed: true,
    })
  })

  it('keeps unset preferences as null, never a bogus zero', () => {
    const store = createPanelPreferenceStore(createMemoryStorage())
    expect(store.geometry()).toEqual({ panelWidth: null, railWidth: null, railCollapsed: null })
    // Partial record: only what the user actually chose is remembered.
    store.recordGeometry({ panelWidth: 505 })
    expect(store.geometry()).toEqual({ panelWidth: 505, railWidth: null, railCollapsed: null })
  })

  it('lets a later record overwrite one field without clobbering the rest', () => {
    const store = createPanelPreferenceStore(createMemoryStorage())
    store.recordGeometry({ panelWidth: 505, railWidth: 201, railCollapsed: true })
    store.recordGeometry({ railCollapsed: false })
    expect(store.geometry()).toEqual({ panelWidth: 505, railWidth: 201, railCollapsed: false })
  })

  it('persists a versioned envelope', () => {
    const storage = createMemoryStorage()
    createPanelPreferenceStore(storage).recordGeometry({ panelWidth: 505 })
    const envelope = JSON.parse(storage.getItem('dsh-md-preview.prefs.v1') ?? '{}') as { version: number }
    expect(envelope.version).toBe(PANEL_PREFERENCE_VERSION)
  })

  it('separates the files/outline choice per session', () => {
    const storage = createMemoryStorage()
    const store = createPanelPreferenceStore(storage)
    store.recordRailTab('session-1', 'outline')
    store.recordRailTab('session-2', 'files')
    expect(store.railTab('session-1')).toBe('outline')
    expect(store.railTab('session-2')).toBeNull()
    const reopened = createPanelPreferenceStore(storage)
    expect(reopened.railTab('session-1')).toBe('outline')
    expect(reopened.railTab('session-2')).toBeNull()
  })

  it('bounds the remembered sessions', () => {
    const store = createPanelPreferenceStore(createMemoryStorage())
    for (let i = 0; i < 40; i += 1) store.recordRailTab(`s-${i}`, 'outline')
    expect(store.railTab('s-0')).toBeNull()
    expect(store.railTab('s-39')).toBe('outline')
  })

  it('treats an absent, empty, or damaged envelope as defaults', () => {
    const storage = createMemoryStorage()
    expect(createPanelPreferenceStore(storage).geometry().panelWidth).toBeNull()
    storage.setItem('dsh-md-preview.prefs.v1', '')
    expect(createPanelPreferenceStore(storage).geometry().panelWidth).toBeNull()
    storage.setItem('dsh-md-preview.prefs.v1', '{damaged json')
    const store = createPanelPreferenceStore(storage)
    expect(store.geometry().panelWidth).toBeNull()
    // The damaged envelope gives way to a working one on the next write.
    store.recordGeometry({ panelWidth: 505 })
    expect(store.geometry().panelWidth).toBe(505)
  })

  it('discards foreign-version envelopes as old records', () => {
    const storage = createMemoryStorage()
    storage.setItem('dsh-md-preview.prefs.v1', JSON.stringify({
      version: PANEL_PREFERENCE_VERSION + 3,
      panelWidth: 999,
      railWidth: 999,
      railCollapsed: true,
    }))
    expect(createPanelPreferenceStore(storage).geometry()).toEqual({
      panelWidth: null, railWidth: null, railCollapsed: null,
    })
  })

  it('drops invalid values but keeps the valid ones in one envelope', () => {
    const storage = createMemoryStorage()
    storage.setItem('dsh-md-preview.prefs.v1', JSON.stringify({
      version: PANEL_PREFERENCE_VERSION,
      panelWidth: 'wide',
      railWidth: -4,
      railCollapsed: 'yes',
      railTabs: { 's-1': { tab: 'outline', at: 5 }, 's-2': { tab: 'diagram', at: 6 } },
    }))
    const store = createPanelPreferenceStore(storage)
    expect(store.geometry()).toEqual({ panelWidth: null, railWidth: null, railCollapsed: null })
    expect(store.railTab('s-1')).toBe('outline')
    expect(store.railTab('s-2')).toBeNull()
  })

  it('keeps serving from memory when the storage throws', () => {
    const store = createPanelPreferenceStore({
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceededError') },
    })
    expect(store.geometry().panelWidth).toBeNull()
    store.recordGeometry({ panelWidth: 505 })
    store.recordRailTab('s-1', 'outline')
    expect(store.geometry().panelWidth).toBe(505)
    expect(store.railTab('s-1')).toBe('outline')
  })
})

describe('width clamping to the live viewport', () => {
  it('keeps a stored width inside the supported range and the viewport', () => {
    expect(clampPanelWidth(500, 1920)).toBe(500)
    expect(clampPanelWidth(1200, 1920)).toBe(1200)
    expect(clampPanelWidth(2000, 1920)).toBe(1200)
    expect(clampPanelWidth(100, 1920)).toBe(360)
    // The viewport shrank below the stored width: fit the screen.
    expect(clampPanelWidth(1000, 800)).toBe(800)
    expect(clampPanelWidth(1000, 480)).toBe(480)
  })

  it('opens a stored minimal width on a viewport smaller than it (not zero)', () => {
    expect(clampPanelWidth(360, 300)).toBe(300)
    expect(clampPanelWidth(360, 0)).toBe(360)
  })

  it('derives the default from the viewport, never landing on min from emptiness', () => {
    expect(clampPanelWidth(null, 1920)).toBe(720)
    expect(clampPanelWidth(null, 500)).toBe(360)
    expect(clampPanelWidth(null, 0)).toBe(720)
  })

  it('clamps the rail width into its own range', () => {
    expect(clampRailWidth(200)).toBe(200)
    expect(clampRailWidth(80)).toBe(120)
    expect(clampRailWidth(999)).toBe(320)
    expect(clampRailWidth(null)).toBe(148)
  })
})
