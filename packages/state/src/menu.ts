/**
 * The static menu hierarchy (001 §4.2).
 *
 * This is the *shape* of the tree, not its contents. Rows that name a thing in
 * the library — a playlist, an artist, an album — are built by the layer that
 * has the library; what lives here is the part that is the same on every
 * device, for every account, before any network call.
 *
 * That split is why the main menu can render on the first frame: nothing in
 * this file needs to be fetched.
 *
 * ⚑ Two removals are deliberate and are not omissions. `Photos`, `Podcasts`,
 * `Audiobooks`, `Contacts`, `Calendars`, `Notes` and the video-playlist
 * surfaces of the 2005 tree are gone — this is a music product, and a
 * half-implemented podcast tab is worse than no podcast tab. `Composers` is
 * kept despite low traffic, on purpose.
 */

import type {
  Density,
  MenuNode,
  MenuVisibility,
  PanelRow,
  ScreenFrame,
  ScreenId,
} from './contract'

/**
 * The front-face menu tree, root first (001 §4.2).
 *
 * `Now Playing` is present in this tree but is only shown while audio is
 * loaded, and `Radio` is **absent from the rendered menu** rather than greyed
 * out when the provider cannot make stations — a disabled row for a feature
 * that will never work on this account is a promise the product cannot keep.
 *
 * Both are decided by the layer that knows the provider and the queue, through
 * the {@link MenuVisibility} predicate that {@link menuRows} and
 * {@link menuFrame} accept. The default admits everything, which is the honest
 * answer at construction: no provider has been asked yet. ⚑ A device seeded
 * with the default therefore shows `Radio` and `Now Playing`, and whoever
 * learns the truth must re-seed through `resetStackActionAtom`.
 *
 * `Settings` turns the device over rather than pushing a screen. It is the one
 * front-face row that does.
 */
export const MENU_ROOT: MenuNode = {
  label: 'iPod',
  screenId: 'S03',
  children: [
    {
      label: 'Music',
      screenId: 'S04',
      children: [
        { label: 'Playlists', screenId: 'S05' },
        { label: 'Artists', screenId: 'S06' },
        { label: 'Albums', screenId: 'S08' },
        { label: 'Songs', screenId: 'S09' },
        { label: 'Genres', screenId: 'S10' },
        { label: 'Composers', screenId: 'S11' },
        { label: 'Search', screenId: 'S12' },
        { label: 'Cover Flow', screenId: 'S19' },
      ],
    },
    { label: 'Radio', screenId: 'S18' },
    { label: 'Music Videos', screenId: 'S23' },
    { label: 'Up Next', screenId: 'S17' },
    {
      label: 'Extras',
      screenId: 'S20',
      children: [
        { label: 'Clock & Sleep Timer', screenId: 'S21' },
        { label: 'Brick', screenId: 'S22' },
        { label: 'Screen Lock', screenId: 'S28' },
        { label: 'Agent Console', screenId: 'S25' },
      ],
    },
    { label: 'Settings', screenId: 'B01', flips: true },
    { label: 'Shuffle Songs', screenId: 'S24' },
    { label: 'Now Playing', screenId: 'S13' },
  ],
}

/**
 * The back-face settings tree (001 §4.2).
 *
 * Reached by turning the device over. `Menu` at the root of a back surface
 * ascends out of the flip and restores the exact front screen, because the
 * flip is a level in the hierarchy rather than a mode.
 */
export const SETTINGS_ROOT: MenuNode = {
  label: 'Settings',
  screenId: 'B01',
  children: [
    { label: 'Playback', screenId: 'B02' },
    { label: 'Display & Feel', screenId: 'B03' },
    { label: 'Assistant', screenId: 'B04' },
    { label: 'Account & Apple Music', screenId: 'B05' },
    { label: 'About', screenId: 'B06' },
    { label: 'The Engraving', screenId: 'B07' },
    { label: 'Shortcuts', screenId: 'B09' },
    { label: 'Legal & Reset', screenId: 'B08' },
  ],
}

/**
 * Walks the tree by label, the way a navigation tool's `path` argument does.
 *
 * Matching is exact and case-sensitive: these labels are the product's own
 * copy, not user input, and a fuzzy match here would silently send a caller
 * somewhere it never named.
 *
 * @returns The node at the end of the path, or `null` if any segment misses.
 */
export function findMenuNode(
  path: readonly string[],
  root: MenuNode = MENU_ROOT,
): MenuNode | null {
  let node: MenuNode = root
  for (const segment of path) {
    const child = node.children?.find((candidate) => candidate.label === segment)
    if (child === undefined) return null
    node = child
  }
  return node
}

/**
 * Turns a node's children into list rows.
 *
 * A child that has children of its own gets a `descend` glyph — the chevron
 * that says the row goes somewhere — and one that does not is a leaf the
 * layer above resolves. Menu rows carry no provenance: nobody put `Artists`
 * there, it is part of the device.
 */
export function menuRows(
  node: MenuNode,
  isVisible: MenuVisibility = () => true,
): readonly PanelRow[] {
  return (node.children ?? [])
    .filter((child) => isVisible(child))
    .map((child, index) => ({
      // Re-indexed after filtering, deliberately. A row's `index` is its
      // position on the screen the human is looking at, and it is what a
      // navigation tool is told to move to — an index that counted rows nobody
      // can see would send that tool somewhere else.
      index,
      label: child.label,
      sublabel: null,
      glyphs: child.children === undefined && child.flips !== true ? [] : ['descend' as const],
      provenance: null,
    }))
}

/**
 * Builds a ready-to-push frame for a menu node.
 *
 * The highlight starts at the first row, or at `-1` when the node has no
 * children — which happens for a leaf whose contents come from elsewhere, and
 * is a legitimate frame rather than an error.
 *
 * @param node - The node whose children become the rows.
 * @param density - The density this screen *prefers*, from 001 §3.1. What it
 *   renders at is `effectiveDensityAtom`, which reconciles this against the
 *   human's setting and Dynamic Type.
 * @param screenId - Overrides the node's own screen id, for the case where one
 *   node is rendered as more than one screen.
 * @param isVisible - Drops rows the provider cannot serve. Defaults to showing
 *   everything.
 */
export function menuFrame(
  node: MenuNode,
  density: Density,
  screenId?: ScreenId,
  isVisible?: MenuVisibility,
): ScreenFrame {
  const rows = menuRows(node, isVisible)
  const id = screenId ?? node.screenId
  if (id === undefined) {
    throw new Error(`Menu node "${node.label}" has no screen id and none was supplied`)
  }
  return {
    screenId: id,
    title: node.label,
    density,
    rows,
    highlightIndex: rows.length === 0 ? -1 : 0,
    windowStart: 0,
  }
}
