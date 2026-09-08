# Implementation notes

- The welcome wraps the existing `DevicePage` before its effects mount. Supported
  browsers keep the existing live player and context-restoration owner. Development
  capture modes keep their existing physical calibration surface.
- Browser version only chooses instructions. Even Chromium 200 with no observed
  API still receives setup guidance; a browser exposing the API bypasses setup.
- The existing compositor deliberately puts reduced-motion users into T4. This
  change supplies an honest still preview for that previously empty path, without
  claiming that an enabled experiment is missing. Reworking that live-player
  accessibility policy is not included. Preference changes refresh the gate.
- Use original demo copy and drawn sleeve artwork with a regular `CanvasTexture`;
  reuse three existing immutable sticker assets. No personal sticker placements,
  provider transport, HTMLTexture, or WebMCP initialization in the preview.
- The 24-second storyboard holds front 7s, turns 4s, holds rear 6s, turns 4s, rests
  front 3s. Quintic easing gives stationary joins. Screen raster updates at 12fps;
  geometry follows the display frame rate. Pause and visibility cancel scheduling;
  effect cleanup releases the material and texture. Reduced motion resets front.
- Native clipboard denial exposes manual-copy instructions. The flags anchor has
  `target="_blank"`; the primary action copies because privileged navigation is
  blocked from web pages. No browser-wide flags were changed during validation.
- Visual revision: shorten the copy action and put the model above introductory
  copy on mobile, keeping the actual teaser visible in the initial screen.

## Source verification

Chrome guidance: https://developer.chrome.com/blog/html-in-canvas-origin-trial
and https://wicg.github.io/html-in-canvas/. Neither establishes a stable shipping
milestone. The published Canary 149 recommendation is used only for update copy.
Pinned implementation: Three 0.185.1 CanvasTexture and Fiber 9.7.0 installed types.
