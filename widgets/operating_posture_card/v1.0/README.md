# operating_posture_card — v1.0 (stub)

Widget sub-agent: populate this directory with the 6 canonical files.

## Source primitives

- `workshopContext.operatingPosture.statement` — 1–3 sentences, workshop-derived
- `workshopContext.operatingPosture.framing` — qualifier badge text (e.g. "regulated, fiduciary, member-first")

## Expected files

- `index.html` — widget render (reads `window.widgetData`)
- `widget.css` — widget-scoped styles (imports ../../tokens.css + ../../base.css)
- `field-template.json` — field dependency spec
- `version.json` — version metadata
- `example-coastline.html` — self-contained render with Coastline Super data
- `example-fmt.html` — self-contained render with FMT data

## Visual reference

See `fixtures/FMT/se-briefing/04.5a-fmt-diagnostic.html` — `.posture-card` with
`--card` background, 17px `--ink-2` body text, bold keywords in `--ink`. The
framing qualifier should render as a small badge (inline-flex pill) beneath the
statement, using the `--line` border style with teal or purple accent.
