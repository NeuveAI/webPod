import { describe, expect, test } from 'bun:test'

import { VISIBLE_ROWS } from './contract'
import type { Density, PanelRow, ScreenFrame, ScreenId } from './contract'
import { MENU_ROOT, SETTINGS_ROOT, findMenuNode, menuFrame, menuRows } from './menu'
import { moveHighlight, pageHighlight, popScreen, pushScreen, readScreen, resetStack } from './screen'

function rows(count: number): readonly PanelRow[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    label: `Row ${String(index + 1)}`,
    sublabel: null,
    glyphs: [],
    provenance: null,
  }))
}

function frame(
  screenId: ScreenId,
  rowCount: number,
  density: Density = 'medium',
): ScreenFrame {
  return {
    screenId,
    title: screenId,
    density,
    rows: rows(rowCount),
    highlightIndex: rowCount === 0 ? -1 : 0,
    windowStart: 0,
  }
}

const top = (stack: readonly ScreenFrame[]): ScreenFrame => {
  const frameAtTop = stack[stack.length - 1]
  if (frameAtTop === undefined) throw new Error('empty stack')
  return frameAtTop
}

describe('highlight movement', () => {
  test('moves by the exact row delta it is given', () => {
    const start = pushScreen([], frame('S09', 20)).stack
    const moved = moveHighlight(start, 3, VISIBLE_ROWS.medium)

    expect(top(moved.stack).highlightIndex).toBe(3)
    expect(moved.bump).toBeNull()
  })

  test('clamps at the bottom and bumps rather than wrapping', () => {
    const start = pushScreen([], frame('S09', 5)).stack
    const moved = moveHighlight(start, 40, VISIBLE_ROWS.medium)

    expect(top(moved.stack).highlightIndex).toBe(4)
    expect(moved.bump).toBe('down')
  })

  test('clamps at the top and bumps', () => {
    const start = pushScreen([], frame('S09', 5)).stack
    const moved = moveHighlight(start, -3, VISIBLE_ROWS.medium)

    expect(top(moved.stack).highlightIndex).toBe(0)
    expect(moved.bump).toBe('up')
  })

  test('an empty list bumps in the direction of travel', () => {
    const start = pushScreen([], frame('S05', 0)).stack
    expect(moveHighlight(start, 1, VISIBLE_ROWS.medium).bump).toBe('down')
    expect(top(moveHighlight(start, 1, VISIBLE_ROWS.medium).stack).highlightIndex).toBe(-1)
  })

  test('a zero delta is not a bump — nothing was requested', () => {
    const start = pushScreen([], frame('S09', 5)).stack
    expect(moveHighlight(start, 0, VISIBLE_ROWS.medium).bump).toBeNull()
  })
})

describe('the scroll window', () => {
  test('stays put while the highlight is inside it', () => {
    const start = pushScreen([], frame('S09', 30)).stack
    const moved = moveHighlight(start, VISIBLE_ROWS.medium - 1, VISIBLE_ROWS.medium)

    expect(top(moved.stack).windowStart).toBe(0)
  })

  test('slides by the minimum needed, never recentring', () => {
    const start = pushScreen([], frame('S09', 30)).stack
    const moved = moveHighlight(start, VISIBLE_ROWS.medium, VISIBLE_ROWS.medium)

    // The highlight moved one row past the window, so the window moves one row.
    expect(top(moved.stack).windowStart).toBe(1)
  })

  test('never scrolls past the last full page', () => {
    const start = pushScreen([], frame('S09', 10)).stack
    const moved = moveHighlight(start, 9, VISIBLE_ROWS.medium)

    expect(top(moved.stack).windowStart).toBe(10 - VISIBLE_ROWS.medium)
  })

  test('slides back up when the highlight moves above the window', () => {
    const start = pushScreen([], frame('S09', 30)).stack
    const down = moveHighlight(start, 20, VISIBLE_ROWS.medium)
    const up = moveHighlight(down.stack, -20, VISIBLE_ROWS.medium)

    expect(top(up.stack).highlightIndex).toBe(0)
    expect(top(up.stack).windowStart).toBe(0)
  })
})

describe('paging', () => {
  test('one page is one full viewport of rows, per density', () => {
    for (const density of ['compact', 'medium', 'airy'] as const) {
      const start = pushScreen([], frame('S09', 100, density)).stack
      const paged = pageHighlight(start, 1, VISIBLE_ROWS[density])
      expect(top(paged.stack).highlightIndex).toBe(VISIBLE_ROWS[density])
    }
  })

  test('a page that runs off the end lands on the end, and bumps', () => {
    const start = pushScreen([], frame('S09', 4)).stack
    const paged = pageHighlight(start, 1, VISIBLE_ROWS.medium)

    expect(top(paged.stack).highlightIndex).toBe(3)
    expect(paged.bump).toBe('down')
  })
})

describe('push and pop', () => {
  test('pop restores the exact prior highlight index', () => {
    const root = pushScreen([], frame('S03', 8)).stack
    const positioned = moveHighlight(root, 5, VISIBLE_ROWS.medium).stack
    expect(top(positioned).highlightIndex).toBe(5)

    const descended = pushScreen(positioned, frame('S08', 40)).stack
    const wandered = moveHighlight(descended, 30, VISIBLE_ROWS.medium).stack
    expect(top(wandered).highlightIndex).toBe(30)

    const back = popScreen(wandered)
    expect(top(back.stack).screenId).toBe('S03')
    expect(top(back.stack).highlightIndex).toBe(5)
    expect(back.bump).toBeNull()
  })

  test('pop restores the exact prior scroll window too', () => {
    const root = pushScreen([], frame('S09', 60)).stack
    const scrolled = moveHighlight(root, 25, VISIBLE_ROWS.medium).stack
    const windowStart = top(scrolled).windowStart
    expect(windowStart).toBeGreaterThan(0)

    const descended = pushScreen(scrolled, frame('S08', 12)).stack
    const back = popScreen(descended)

    expect(top(back.stack).windowStart).toBe(windowStart)
  })

  test('Menu at the root bumps rightward — it is never a no-op', () => {
    const root = pushScreen([], frame('S03', 8)).stack
    const popped = popScreen(root)

    expect(popped.stack).toEqual(root)
    expect(popped.bump).toBe('right')
  })

  test('push normalises a highlight the caller got wrong', () => {
    const pushed = pushScreen([], {
      ...frame('S08', 3),
      highlightIndex: 99,
      windowStart: 40,
    })

    expect(top(pushed.stack).highlightIndex).toBe(2)
    expect(top(pushed.stack).windowStart).toBe(0)
  })

  test('an empty screen pushes with no highlight rather than row zero', () => {
    const pushed = pushScreen([], frame('S05', 0))
    expect(top(pushed.stack).highlightIndex).toBe(-1)
  })

  test('resetStack discards intervening levels', () => {
    const deep = pushScreen(
      pushScreen(pushScreen([], frame('S03', 8)).stack, frame('S04', 8)).stack,
      frame('S08', 8),
    ).stack
    expect(deep).toHaveLength(3)

    const reset = resetStack([frame('S03', 8)])
    expect(reset.stack).toHaveLength(1)
    expect(top(reset.stack).screenId).toBe('S03')
  })
})

describe('the enumerable screen description', () => {
  test('reports the visible window by default, with absolute row indices', () => {
    const stack = moveHighlight(
      pushScreen([], frame('S09', 40)).stack,
      20,
      VISIBLE_ROWS.medium,
    ).stack

    const snapshot = readScreen({ face: 'front', frame: top(stack), density: top(stack).density, agentActive: false })

    expect(snapshot.rows).toHaveLength(VISIBLE_ROWS.medium)
    expect(snapshot.totalRows).toBe(40)
    expect(snapshot.visibleRows).toBe(VISIBLE_ROWS.medium)
    expect(snapshot.highlightIndex).toBe(20)
    expect(snapshot.rows[0]?.index).toBe(top(stack).windowStart)
    expect(snapshot.rows.some((row) => row.index === 20)).toBe(true)
  })

  test('reports every row when it requests the offscreen ones', () => {
    const stack = pushScreen([], frame('S09', 40)).stack
    const snapshot = readScreen(
      { face: 'front', frame: top(stack), density: top(stack).density, agentActive: false },
      { includeOffscreenRows: true },
    )

    expect(snapshot.rows).toHaveLength(40)
  })

  test('carries the face and the flag, and nothing about agent presence', () => {
    const stack = pushScreen([], frame('B01', 8)).stack
    const snapshot = readScreen({ face: 'back', frame: top(stack), density: top(stack).density, agentActive: true })

    expect(snapshot.face).toBe('back')
    expect(snapshot.agentActive).toBe(true)
    expect(Object.keys(snapshot).sort()).toEqual([
      'agentActive',
      'density',
      'face',
      'highlightIndex',
      'rows',
      'screenId',
      'title',
      'totalRows',
      'visibleRows',
    ])
  })
})

describe('the menu hierarchy', () => {
  test('the root menu is the 001 §4.2 tree, in order', () => {
    expect(menuRows(MENU_ROOT).map((row) => row.label)).toEqual([
      'Music',
      'Radio',
      'Music Videos',
      'Up Next',
      'Extras',
      'Settings',
      'Shuffle Songs',
      'Now Playing',
    ])
  })

  test('Music holds the eight browse slices', () => {
    const music = findMenuNode(['Music'])
    expect(music?.children?.map((child) => child.label)).toEqual([
      'Playlists',
      'Artists',
      'Albums',
      'Songs',
      'Genres',
      'Composers',
      'Search',
      'Cover Flow',
    ])
  })

  test('the removed 2005 surfaces are absent, not hidden', () => {
    const labels = menuRows(MENU_ROOT).map((row) => row.label)
    for (const removed of ['Photos', 'Podcasts', 'Audiobooks', 'Contacts', 'Calendars', 'Notes']) {
      expect(labels).not.toContain(removed)
    }
  })

  test('Settings turns the device over rather than pushing a screen', () => {
    expect(findMenuNode(['Settings'])?.flips).toBe(true)
  })

  test('a path that misses returns null rather than the nearest match', () => {
    expect(findMenuNode(['Music', 'Podcasts'])).toBeNull()
    expect(findMenuNode(['music'])).toBeNull()
  })

  test('the settings tree is reachable from the back face root', () => {
    expect(findMenuNode(['The Engraving'], SETTINGS_ROOT)?.screenId).toBe('B07')
  })

  test('a menu frame starts on its first row', () => {
    const built = menuFrame(MENU_ROOT, 'medium')
    expect(built.screenId).toBe('S03')
    expect(built.title).toBe('iPod')
    expect(built.highlightIndex).toBe(0)
    expect(built.windowStart).toBe(0)
  })
})
