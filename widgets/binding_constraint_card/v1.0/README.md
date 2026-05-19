# binding_constraint_card — v1.0 (stub)

Widget sub-agent: populate this directory with the 6 canonical files.

## Source primitives

- `workshopContext.bindingConstraint` — label, description, currentMetric, targetMetric, strategicLeverage, valueStreamStageRef
- `workshopContext.valueStream.stages[bindingStageIndex]` — the binding stage for the deep-link badge

## Expected files

- `index.html` — widget render (reads `window.widgetData`)
- `widget.css` — widget-scoped styles (imports ../../tokens.css + ../../base.css)
- `field-template.json` — field dependency spec
- `version.json` — version metadata
- `example-coastline.html` — self-contained render with Coastline Super data
- `example-fmt.html` — self-contained render with FMT data

## Visual reference

See `fixtures/FMT/se-briefing/04.5a-fmt-diagnostic.html` — `.constraint` card +
coral border (`--card-coral-line`) + `.constraint .badge` + current/target metric
delta rendering. The deep-link badge references the heatmap stage by stageId.
