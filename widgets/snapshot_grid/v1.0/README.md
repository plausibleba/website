# snapshot_grid — v1.0 (stub)

Widget sub-agent: populate this directory with the 6 canonical files.

## Source primitives

- `workshopContext.businessSnapshot.metrics[]` — each metric: label, value, unit?, note?, trendDirection?

## Expected files

- `index.html` — widget render (reads `window.widgetData`)
- `widget.css` — widget-scoped styles (imports ../../tokens.css + ../../base.css)
- `field-template.json` — field dependency spec
- `version.json` — version metadata
- `example-coastline.html` — self-contained render with Coastline Super data (14 metrics)
- `example-fmt.html` — self-contained render with FMT data

## Visual reference

See `fixtures/FMT/se-briefing/04.5a-fmt-diagnostic.html` — `.snapshot` 3-col grid +
`.snap` cards. Large `.value` (28px 700w), `.label` UPPERCASE, `.note` muted.
Trend arrows: up = green (--trend-up), down = amber (--trend-down).

## Note on customer-specificity

Metric labels (Members, FUM, AFCA Escalation Rate, etc.) live in
`workshopContext.businessSnapshot.metrics[].label` — customer-specific.
The widget itself is generic: it renders any `metrics[]` array. This is
the D-137 spec's explicit design — widget ships once, customer labels travel
in the substrate.
