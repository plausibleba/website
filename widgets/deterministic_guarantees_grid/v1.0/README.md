# deterministic_guarantees_grid — v1.0 (stub)

Widget sub-agent: populate this directory with the 6 canonical files.

## Source primitives

- `charter.decisionSurface` — what the agent decides
- `charter.authorityScope.prohibitions[]` filtered to `enforcement === "platform"` — hard platform enforcements
- `charter.escalationTriggers[]` — conditions that route to human
- `charter.knowledgeAnchors[]` — knowledge sources the agent is bound to

## Expected files

- `index.html` — widget render (reads `window.widgetData`)
- `widget.css` — widget-scoped styles (imports ../../tokens.css + ../../base.css)
- `field-template.json` — field dependency spec
- `version.json` — version metadata
- `example-coastline.html` — self-contained render with Coastline Super data
- `example-fmt.html` — self-contained render with FMT data

## Visual reference

See `fixtures/FMT/se-briefing/04.5a-fmt-diagnostic.html` — `.det-panel` +
`.det-grid` (4-column) + `.det-cell` cards with `.primitive` monospace labels.
