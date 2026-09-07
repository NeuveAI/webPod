# Retained partial-peel visual audit

No browser, product/source edit or new capture. These images are ffmpeg extraction/crops of `../video/page@5f9175fc23161e9bab2f2563e910da60.webm` (1280×900,25fps,24.28s). Review also used original `wrapped-1280-{side,front}-{attached,partial-peel}.png` and witness7 coordinates. Video PTS is not synchronized here to browser performance.now or native input dispatch clocks. Each sampled boundary is accurate only to the recorded40ms frame cadence.

## Side partial/cancel

The original attached print fits around the top corner at approximately x500–584,y85–265. The side pointer moves561.85/140.38→579.45/167.10, down/right32px. The retained partial screenshot shows a broad upper section extended upward beyond the viewport, despite this still-partial gesture. The lower orange ticket and long tip remain visually seated near their original location.

In `side-2.08-3.32.png`, tiles run left-to-right/top-to-bottom, starting2.08s in40ms increments. At2.52s the print remains compact. At2.56s the upper print has unfolded sharply upward; at2.60–2.76s its top is cropped by the original viewport. Cancel reduces it at2.80s, and it is compact again at2.84s. Standalone2.56/2.60 frames preserve full viewport context. This is an abrupt visual change across recorded frames, not proof of a mathematical discontinuity or a measured pointer-latency jump.

The picked coordinate lies near the orange ticket, whose region appears seated. The video does not mark the exact material UV, so it does not establish that the exact grabbed pixel itself leaves the viewport. It does establish that the detached upper region leaves the viewport before full detachment, while the pointer travels only32px down/right.

## Front partial/cancel

The front pointer moves762.67/137.99→772.64/120.66 by20px up/right. The original partial screenshot exposes a broad backing flap above the device, approximately y28–112, still entirely in view. In `front-11.4-12.64.png`, tiles start11.40s in40ms increments. Small backing appears11.92s, enlarges11.96s and reaches the retained raised flap by12.00s; cancel reduces it12.20–12.24s and the print is compact by12.28s. No viewport exit is visible in this partial front case. Exact picked-UV displacement is not established by unmarked frames.

## Limits and implication

These are pre-full-detach observations. The held32px side screenshot and20px front screenshot correspond to the driver's successful partial state checks, not its later full carry. They do not verify the device probe's reported220–256model-unit full-peel anchor displacement. They do show that preserving the existing attached rows alone is insufficient to establish acceptable partial detached-shape motion. New canonical transition work must still be visually checked through the earlier partial interval, with the original art and actual pointer path.
