# Dynamic Type density layout correction

## Result

Implementation commit: `e359586299f1842894bcd88102e8333f928add8d`

The main menu still gets its effective density and visible-row count from the
state store. The correction is layout-only:

- `[data-density="airy"][data-visible-rows="4"]` uses four explicit `44px`
  grid tracks and `17px` row type, matching 001 `pm-spec.md` §3.
- The base compact rule remains eight `21px` rows with `11px` type. There is no
  medium selector, so the existing 100% compact/medium rendering is unchanged.
- The probe's bare preview now reserves the Dynamic Type raster's real
  `272×204 × min(scale, 1.25)` dimensions and scales that authored surface only
  when the available viewport is smaller. It no longer clips the fourth airy
  row on desktop or mobile.
- `/_spike/device` still mounts `<Panel colourway={panelTone} state="ready" />`
  at its default scale and compact density. The implementation commit does not
  change that route or any device geometry/material source.

Before the correction, the 130% bare probe reported a `228.75px` transformed
list, four `26.25px` transformed rows, and `123.75px` of vacant list space. In
logical raster pixels that is the fixed compact rule: `183 - (4 × 21) = 99px`
vacant. After the correction, the browser reports four `44px` logical rows,
`17px` type, `176px` used, and `7px` remaining in the `183px` menu body.

## Browser matrix

`apps/web/tests/density-layout.e2e.ts` exercised real Google Chrome with
`CanvasDrawElement`, so composited cases used the T1 canvas path rather than a
DOM-only fallback.

- Airy: black/white × 130%/200% × bare/composited × front/quarter = 16 cases.
- Compact control: black/white × bare/composited × front/quarter = 8 cases.
- Mobile airy fit: black/white × 130%/200% at 390×844 = 4 cases.
- Every airy case measured `[44, 44, 44, 44]`, `[17, 17, 17, 17]`, no row-text
  clipping, and retained the title bar, preview, rail, and separators.
- Every compact case measured eight `21px` rows and eight `11px` font sizes.

The final immutable-source run was:

```text
COMMIT e359586299f1842894bcd88102e8333f928add8d
TREE 31ecaa30e53ba191a18520ac22348d6e894475c6
SOURCE 587366935e59a259784a7bc45269282c3665b13f9cbb593a34c10837cd3ad352
3 passed (18.7s)
```

## Mutation proof

Each ruling-shaped value was changed independently and the real-browser test
was rerun against a fresh served-source snapshot:

```text
repeat(4, 44px) -> repeat(4, 21px)
RED: received [21, 21, 21, 21], expected [44, 44, 44, 44]

font-size: 17px -> font-size: 11px
RED: received [11, 11, 11, 11], expected [17, 17, 17, 17]
```

The package-level CSS contract test also fails if the attribute selector, grid,
track count, row height, airy type size, or compact controls drift.

## Visual captures

- `airy-black-130-composited-front.png`
- `airy-white-200-composited-quarter.png`
- `compact-black-100-composited-front.png`
- `airy-white-130-bare-mobile.png`

These captures are the manual visual pass from the live route. The immutable
commit identity above belongs to the executable geometry assertions, not to
the PNG files.

## Gates

```text
typecheck       11/11 projects clean
lint            exit 0
repo tests      1107 pass, 0 fail
focused E2E     3 pass, 0 fail
production build exit 0
automated gates 16 pass, 0 fail
manual gates    U14/U15 remain the workstream's pre-existing owner/reviewer checks
```

