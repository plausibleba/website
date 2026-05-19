# VCC Widget Set — v1.0 Publication Infrastructure

**Status:** v1.0 published 2026-05-19. One widget fully populated (`bundle_metric_strip`); 7 stubs ready for follow-on sub-agents.

**URL channel:** `https://plausibleba.com/widgets/<widget-id>/v<major.minor>/`
Note: `plausibleba.com/widgets/` will redirect to `widgets.plausibleba.com/` once subdomain DNS lands. The URL shape is stable from day one — STRAT manifests can pin either form; both resolve identically after DNS cut-over.

**Hosting:** `vcc/website/widgets/` auto-deploys to Vercel via the `plausibleba/website` remote.

---

## URL grammar (locked — D-137 Q2)

```
https://plausibleba.com/widgets/<widget-id>/v<major>.<minor>/
```

- `<widget-id>` — snake_case identifier (e.g. `bundle_metric_strip`)
- `v<major>.<minor>` — locked minor path (e.g. `v1.0`)
- Patch releases overwrite the same `v<major>.<minor>/` directory
- Major bumps go to a new `v<major+1>.0/` directory
- `index.json` at `plausibleba.com/widgets/` is the machine-readable registry

### URL immutability commitment (locked — Dan Roach 2026-05-17)

**All prior minor URLs stay live indefinitely.** Not just for a deprecation window — indefinitely. STRAT manifests pin specific minors. If a customer's strategic page is regenerated 6 months later under audit, the pinned widget URL must still resolve. Older minors are marked `"superseded": true` in `index.json` so authoring agents prefer the latest, but the URL itself never goes away. This is load-bearing for STRAT's audit-anchor reproducibility.

---

## Per-widget directory shape (6 canonical files)

Every widget version directory (`<widget-id>/v1.0/`) must contain exactly these 6 files:

```
<widget-id>/
  v1.0/
    index.html            Widget render — reads from window.widgetData
    widget.css            Widget-scoped styles (imports ../../tokens.css + ../../base.css)
    field-template.json   Field-dependency spec (see schema below)
    version.json          Version metadata (see schema below)
    example-coastline.html  Self-contained render with Coastline Super fixture data inlined
    example-fmt.html        Self-contained render with FMT / Driva fixture data inlined
```

**Canonical example:** `bundle_metric_strip/v1.0/` — fully populated, use as the copy template.

### index.html contract

- Reads all data from `window.widgetData` — injected by STRAT renderer before loading
- No `localStorage` or `sessionStorage` — zero browser storage
- No external network requests — fully self-contained
- No frameworks — vanilla JS only (ES5-compatible for maximum STRAT compatibility)
- Renders a `widget-error` div when `window.widgetData` is missing or malformed
- `window.widgetData` shape: `{ manifest: ExportManifest, workshopContext?: WorkshopContext, charter?: JsonLdCharter }`

### example-*.html contract

- Self-contained — opens directly in a browser with no server
- Has `window.widgetData = { ... }` inlined in a `<script>` tag before the widget script
- Includes all three CSS imports (tokens.css, base.css, widget.css)
- Includes a small header label (non-widget, example-only) naming the fixture and date
- The widget script is inlined (not imported) so the file is fully standalone

### Import order (in all widget HTML files)

```html
<link rel="stylesheet" href="../../tokens.css">   <!-- 1. Design tokens -->
<link rel="stylesheet" href="../../base.css">      <!-- 2. Reset + body background -->
<link rel="stylesheet" href="widget.css">          <!-- 3. Widget-scoped styles -->
```

---

## field-template.json schema

```json
{
  "$schema": "https://plausibleba.com/widgets/field-template-schema/v1.0.json",
  "widgetId": "string",
  "version": "string",
  "description": "string",
  "fieldDependencies": [
    {
      "path": "string",           // dot-path into window.widgetData (e.g. "manifest.canonicalBundleHash")
      "type": "string",           // JS type: "string" | "number" | "boolean" | "string[]" | "object" | "object[]"
      "format": "string",         // optional — e.g. "ISO-8601", "sha256-hex"
      "required": true,           // boolean — widget renders error state if required field is absent
      "displayAs": "string"       // human-readable description of how the field renders
    }
  ],
  "brandTokenSlots": ["string"],  // CSS custom property names the widget supports overriding
  "auditAnchorTemplate": "string",// STRAT audit-anchor template id for this widget's provenance claim
  "sha256": "string",             // content hash of this widget version (populated by verify pass)
  "supportedSubstrateVersions": ["string"]  // D-131, D-134-v1.1, D-137, etc.
}
```

**fieldDependencies path namespaces:**
- `manifest.*` — ExportManifest or VsExportManifest fields
- `workshopContext.*` — WorkshopContext fields (D-137)
- `charter.*` — JsonLdCharter fields

Some widgets (e.g. `complexity_chips_strip`) read from all three namespaces — this is expected and documented in the D-137 spec.

---

## version.json schema

```json
{
  "widgetId": "string",
  "version": "string",            // "v1.0"
  "publishedAt": "string",        // ISO-8601 or null for stubs
  "status": "current | superseded | stub",
  "supersededBy": "string | null",// "v1.1" when this minor is superseded; null otherwise
  "url": "string",                // canonical URL for this version
  "changeLog": ["string"],        // one entry per version
  "urlImmutabilityNote": "string" // standard note referencing Dan's 2026-05-17 commitment
}
```

---

## index.json schema

```json
{
  "$schema": "string",
  "registryVersion": "string",
  "updatedAt": "string",
  "baseUrl": "string",
  "note": "string",
  "widgets": [
    {
      "widgetId": "string",
      "description": "string",
      "sourcePrimitives": ["string"],   // human-readable source primitive list (from D-137 Q3 table)
      "latest": "string",               // "v1.0" — current latest minor
      "status": "published | stub",
      "versions": [
        {
          "version": "string",
          "publishedAt": "string | null",
          "status": "current | superseded | stub",
          "supersededBy": "string | null",
          "url": "string"
        }
      ]
    }
  ]
}
```

---

## manifest.widgets[] integration

The STRAT renderer consumes `manifest.widgets[]` (a `WidgetReference[]` array emitted by `buildExportBundle` when a widget registry is supplied). Each entry declares the widget's versioned URL, field dependencies, and audit-anchor template.

```typescript
interface WidgetReference {
  widgetId: string;             // "bundle_metric_strip"
  version: string;              // "v1.0"
  url: string;                  // "https://plausibleba.com/widgets/bundle_metric_strip/v1.0/"
  sha256: string;               // content hash of widget index.html (drift detection)
  fieldDependencies: string[];  // ["manifest.canonicalBundleHash", "manifest.builtAt", ...]
  brandTokenSlots?: string[];   // optional — customer brand overrides
  auditAnchorTemplate?: string; // optional — STRAT audit-anchor template id
}
```

STRAT reads `manifest.widgets[]` to:
1. Know which widget URLs to embed in the strategic page
2. Verify the sha256 of each widget before rendering (drift detection)
3. Confirm the field dependencies are present in the bundle before attempting to render

---

## Shared design assets

- `tokens.css` — single source for all design tokens (extracted from 04.5a-fmt-diagnostic.html `:root`)
- `base.css` — minimal reset + font setup + radial-gradient body background

Both files are at `website/widgets/` root. Import them relative from widget version directories:

```
../../tokens.css
../../base.css
```

---

## The 8 widgets (v1.0)

| widgetId | Source primitives | Status |
|---|---|---|
| `bundle_metric_strip` | `manifest.*` + `userStories.*` | **published** |
| `value_stream_heatmap` | `workshopContext.valueStream` | stub |
| `deterministic_guarantees_grid` | `charter.decisionSurface` + prohibitions + escalation + knowledge | stub |
| `binding_constraint_card` | `workshopContext.bindingConstraint` + binding stage | stub |
| `complexity_chips_strip` | `manifest.*` + `charter.regulatoryAnchors` + `charter.aesClassification` + `workshopContext.bindingConstraint` | stub |
| `snapshot_grid` | `workshopContext.businessSnapshot.metrics[]` | stub |
| `operating_posture_card` | `workshopContext.operatingPosture` | stub |
| `regulatory_anchors_strip` | `charter.regulatoryAnchors[]` + version | stub |

`det_quote_block` (Albert's 9th) was queried and confirmed workspace-side (STRAT-composable) per Dan's 2026-05-17 reply — not a VCC-published widget.
