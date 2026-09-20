# Greek Ink Exercise Sheets v1

Reviewed source library for the Greek-ink catalog treatment. Accepted exercise tiles are exported as WebP and are integrated into the matching catalog records by `scripts/catalog/integrate-greek-ink-media.mjs`.

## Locked visual contract

- Palette: warm paper `#ece7db` and matte ink `#1c1b18` only.
- Layout: a 3 by 3 grid, with one exercise in each tile.
- Motion: a legible start and finish pose, linked by one small arrow.
- Style: consistent, fully clothed Greek-training-manual-inspired adult model (tunic, leggings, and shoes), technical ink drawing, restrained hatching, plain warm-paper background.
- Acceptance: reject a sheet when any tile has ambiguous exercise mechanics, malformed anatomy, extra limbs, distorted equipment, missing framing, extra colours, text, logos, or watermarks.

## Accepted sheets

| File | Exercise tiles | Status |
| --- | --- | --- |
| `sheet-001-bodyweight-basics.webp` | Bodyweight squat, push-up, forward lunge, plank shoulder tap, standing calf raise, glute bridge, sit-up, jumping jack, burpee | Accepted as visual reference; not mapped to named assets |
| `sheet-002-equipment-basics.webp` | Barbell back squat, barbell deadlift, barbell bench press, dumbbell shoulder press, dumbbell biceps curl, cable lat pulldown, kettlebell swing, seated leg press, cable triceps pressdown | Accepted as visual reference; not mapped to named assets |

## Production sheets

| Sheet | Source | Named tiles | Review |
| --- | --- | --- | --- |
| `sheet-001` | `source-sheets/sheet-001.webp` | `bodyweight-squat`, `incline-push-up`, `bodyweight-walking-lunge`, `plank`, `rocking-standing-calf-raise`, `single-leg-glute-bridge`, `sit-up`, `freehand-jump-squat`, `rope-jumping` | Accepted; all nine movements, objects, anatomy, two-color style, and panel framing visually reviewed |
| `sheet-002` | `source-sheets/sheet-002.webp` | `ankle-circles`, `ankle-on-the-knee`, `arm-circles`, `calf-stretch-elbows-against-wall`, `calf-stretch-hands-against-wall`, `cat-stretch`, `childs-pose`, `chin-to-chest-stretch`, `dancers-stretch` | Accepted; all nine movements, wall anchors, anatomy, two-color style, and panel framing visually reviewed |
| `sheet-003` | `source-sheets/sheet-003.webp` | `3-4-sit-up`, `alternate-heel-touchers`, `bent-knee-hip-raise`, `butt-lift-bridge`, `crunch-hands-overhead`, `crunches`, `dead-bug`, `decline-crunch`, `flutter-kicks` | Accepted; all nine core/bridge movements, bench, anatomy, two-color style, and panel framing visually reviewed |
| `sheet-004` | `source-sheets/sheet-004.png` | `bench-jump`, `frog-hops`, `knee-tuck-jump`, `rocket-jump`, `scissors-jump`, `side-standing-long-jump`, `split-jump`, `star-jump`, `standing-long-jump` | Accepted; all nine jump mechanics, bench, anatomy, two-color style, and panel framing visually reviewed |
| `sheet-005` | `source-sheets/sheet-005.png` | `chair-lower-back-stretch`, `dynamic-back-stretch`, `dynamic-chest-stretch`, `elbow-circles`, `elbows-back`, `front-leg-raises`, `hamstring-stretch`, `hip-circles-prone`, `hug-knees-to-chest` | Accepted after reference-anchored regeneration; all nine mobility movements, props, anatomy, two-color style, and panel framing visually reviewed |
| `sheet-006` | `source-sheets/sheet-006.png` | `jackknife-sit-up`, `mountain-climbers`, `reverse-crunch`, `side-jackknife`, `side-leg-raises`, `superman`, `hanging-leg-raise`, `decline-reverse-crunch`, `flat-bench-lying-leg-raise` | Accepted; all nine core movements, bar/benches, anatomy, two-color style, and panel framing visually reviewed |
| `sheet-007` | `source-sheets/sheet-007.png` | `barbell-bench-press-medium-grip`, `barbell-curl`, `barbell-deadlift`, `barbell-full-squat`, `barbell-glute-bridge`, `barbell-shoulder-press`, `barbell-shrug`, `barbell-side-bend`, `barbell-rear-delt-row` | Accepted; all nine barbell movements, bar/plates/bench, anatomy, two-color style, and panel framing visually reviewed |

Each accepted sheet needs a later exercise-to-tile manifest and crop/export step before it can replace the existing per-exercise catalog media.

## Review log

- Sheet 003, first candidate: rejected before import. The chin-up grip was not distinct from the pull-up grip and the side-plank hip-dip pair was ambiguous.
- Sheet 003, corrected candidate: rejected before import. The pull-up/chin-up distinction still cannot be verified at sheet scale; the side-plank hip-dip pair remains unclear; the model also drifted from the accepted draped Greek-athlete reference into modern shorts.
- Sheet 005, two candidates: rejected before import. Both violated the locked warm-paper/black-ink palette by rendering a black background with coloured edge artifacts. Neither output was copied into the library.
