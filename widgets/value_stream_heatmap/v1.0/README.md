# value_stream_heatmap — v1.0 (stub)

Widget sub-agent: populate this directory with the 6 canonical files.

## Source primitives

- `workshopContext.valueStream.stages[]` — stageId, stageIndex, label, frictionIntensity (0–10), isBinding
- `workshopContext.valueStream.bindingStageIndex` — index into stages[] for coral-border treatment

## Expected files

- `index.html` — widget render (reads `window.widgetData`)
- `widget.css` — widget-scoped styles (imports ../../tokens.css + ../../base.css)
- `field-template.json` — field dependency spec
- `version.json` — version metadata
- `example-coastline.html` — self-contained render with Coastline Super data
- `example-fmt.html` — self-contained render with FMT data

## Visual reference

See `fixtures/FMT/se-briefing/04.5a-fmt-diagnostic.html` — `.vs-stages` grid +
`.stage` cells + `.heat` badges + `.stage.binding` coral treatment.

Heat colour map:
- intensity 6: `#FCA5A5` (--heat-low)
- intensity 7: `#F87171` (--heat-mid-low)
- intensity 8: `#EF4444` (--heat-mid)
- intensity 9: `#DC2626` (--heat-high)
- intensity 10: `#991B1B` box-shadow glow (--heat-critical)
