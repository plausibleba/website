# complexity_chips_strip — v1.0 (stub)

Widget sub-agent: populate this directory with the 6 canonical files.

## Source primitives

This widget is cross-substrate — reads from workshop context, charter, AND manifest:

- `manifest.userStories.derivedFromFrictionIds.length` — friction-observation count (chip 1)
- `charter.regulatoryAnchors.length` — regulatory-anchor count (chip 2)
- `charter.aesClassification` — AES security classification badge (chip 3)
- `workshopContext.bindingConstraint` — binding-constraint presence indicator (chip 4)

## Expected files

- `index.html` — widget render (reads `window.widgetData`)
- `widget.css` — widget-scoped styles (imports ../../tokens.css + ../../base.css)
- `field-template.json` — field dependency spec
- `version.json` — version metadata
- `example-coastline.html` — self-contained render with Coastline Super data
- `example-fmt.html` — self-contained render with FMT data

## Visual reference

See `fixtures/FMT/se-briefing/04.5a-fmt-diagnostic.html` — `.chips-strip` +
`.complexity-chip` cards (4-col grid). Label at top, large number below with
`.accent` teal colouring.

## Note on fieldDependencies namespaces

`fieldDependencies[]` in field-template.json will span three namespaces:
`manifest.*`, `charter.*`, `workshopContext.*`. This is expected and documented
in the D-137 spec as a structural note about this widget's cross-substrate nature.
