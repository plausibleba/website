# regulatory_anchors_strip — v1.0 (stub)

Widget sub-agent: populate this directory with the 6 canonical files.

## Source primitives

- `charter.regulatoryAnchors[]` — each anchor: framework label, jurisdiction, mandatory/advisory flag
- `charter.version` — version pin displayed alongside anchors for audit traceability

## Expected files

- `index.html` — widget render (reads `window.widgetData`)
- `widget.css` — widget-scoped styles (imports ../../tokens.css + ../../base.css)
- `field-template.json` — field dependency spec
- `version.json` — version metadata
- `example-coastline.html` — self-contained render with Coastline Super data (SIS s101, RG 271, RG 277, AFCA)
- `example-fmt.html` — self-contained render with FMT data (NCCP Act, RG 209, Privacy Act)

## Visual reference

See `fixtures/FMT/se-briefing/04.5a-fmt-diagnostic.html` — the `.anchor` chip style
inside `.constraint .anchors`. Horizontal flex-wrap of monospace pill badges.
Each badge: framework code + jurisdiction + mandatory/advisory chip variant.
Teal for mandatory, `--ink-3` for advisory.

## Note on simplicity

This is one of the two simplest widgets (with bundle_metric_strip). Pure-charter
read, no workshop-context dependency. Good reference for sub-agents learning the
widget contract before tackling the more complex cross-substrate widgets.
