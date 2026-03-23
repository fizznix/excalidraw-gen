# excalidraw-gen

A CLI tool that generates [Excalidraw](https://excalidraw.com)-compatible `.excalidraw` JSON files from structured JSON **or YAML** input specs.

Define your diagram with nodes, edges, types, colors, sizes, and arrow styles — get a fully-formed Excalidraw diagram you can open immediately in the browser or desktop app.

---

## Features

- **JSON and YAML input** — both formats supported natively
- **Per-node style overrides** — color, size, shape, opacity, fill pattern, border style
- **Per-edge style overrides** — stroke color, dash style, thickness, opacity
- **DAG layout** — BFS layered layout with Kahn's algorithm (handles cyclic graphs without hanging)
- **Dynamic node sizing** — node height auto-expands for multi-line or long labels
- **Grid layout** — simple √n-column grid for non-hierarchical diagrams
- **Two templates** — `flowchart` and `architecture` with distinct node styles
- **Three themes** — `default`, `pastel`, `dark`
- **Step-routed elbow arrows** — clearly exit the correct edge of the source node
- **Accurate arrow labels** — labels placed at the geometric midpoint of the elbow path
- **Pre-flight validation** — catches Excalidraw JSON issues before writing the file

---

## Installation

```bash
git clone https://github.com/your-username/excalidraw-gen.git
cd excalidraw-gen
npm install
npm run build
```

To use globally:

```bash
npm link
```

---

## Usage

```bash
excalidraw-gen generate <input> [options]
```

| Option | Default | Description |
|---|---|---|
| `--template` | `flowchart` | `flowchart` or `architecture` |
| `--theme` | `default` | `default`, `pastel`, or `dark` |
| `--layout` | `dag` | `dag` or `grid` |
| `--out` | stdout | Output file path (`.excalidraw`) |
| `--max-nodes <n>` | `200` | Reject diagrams with more nodes than this |

### Examples

```bash
# JSON flowchart
excalidraw-gen generate examples/simple-flowchart.json \
  --template flowchart --out out/flow.excalidraw

# YAML input
excalidraw-gen generate examples/pipeline.yaml --out out/pipeline.excalidraw

# Architecture diagram with dark theme
excalidraw-gen generate examples/architecture.json \
  --template architecture --theme dark --out out/arch.excalidraw

# Styled flowchart with per-node/edge colors
excalidraw-gen generate examples/styled-flowchart.json --out out/styled.excalidraw

# Print to stdout (pipe-friendly)
excalidraw-gen generate examples/simple-flowchart.json
```

Open the `.excalidraw` file at [excalidraw.com](https://excalidraw.com) via **Open** → select file.

---

## Input Format

Input can be **JSON** or **YAML**. Both support the same fields.

### JSON

```json
{
  "type": "flowchart",
  "title": "My Diagram",
  "nodes": [
    {
      "id": "start",
      "label": "Start",
      "type": "start",
      "style": {
        "backgroundColor": "#a5d8ff",
        "strokeColor": "#1971c2",
        "shape": "ellipse",
        "width": 160,
        "height": 60
      }
    },
    { "id": "process", "label": "Do Something", "type": "process" },
    {
      "id": "decide",
      "label": "OK?",
      "type": "decision",
      "style": { "strokeStyle": "dashed", "strokeWidth": 3 }
    },
    { "id": "end", "label": "End", "type": "end" }
  ],
  "edges": [
    { "from": "start", "to": "process" },
    { "from": "process", "to": "decide", "label": "Check" },
    {
      "from": "decide",
      "to": "end",
      "label": "Yes",
      "style": { "strokeColor": "#2f9e44", "strokeWidth": 2 }
    }
  ]
}
```

### YAML

```yaml
type: flowchart
title: My Diagram

nodes:
  - id: start
    label: Start
    type: start
    style:
      backgroundColor: "#a5d8ff"
      strokeColor: "#1971c2"
      shape: ellipse

  - id: process
    label: Do Something
    type: process

edges:
  - from: start
    to: process
    label: Go
    style:
      strokeColor: "#7048e8"
      strokeStyle: dashed
```

---

## Style Overrides

### Per-node `style` fields

| Field | Type | Description |
|---|---|---|
| `backgroundColor` | `string` | Fill color (hex, e.g. `"#ff6b6b"` or `"transparent"`) |
| `strokeColor` | `string` | Border color |
| `strokeWidth` | `number` | Border thickness in px |
| `strokeStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | Border style |
| `fillStyle` | `"solid"` \| `"hachure"` \| `"cross-hatch"` \| `"zigzag"` | Fill pattern |
| `shape` | `"rectangle"` \| `"ellipse"` | Override the template shape |
| `width` | `number` | Node width in px |
| `height` | `number` | Node height in px (auto-computed if omitted) |
| `opacity` | `number` | Opacity 0–100 |

### Per-edge `style` fields

| Field | Type | Description |
|---|---|---|
| `strokeColor` | `string` | Arrow color |
| `strokeStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | Line style |
| `strokeWidth` | `number` | Thickness in px |
| `opacity` | `number` | Opacity 0–100 |

---

## Node Types

### Flowchart template

| Type | Default style |
|---|---|
| `start` / `end` | Ellipse |
| `process` | Rectangle (purple) |
| `decision` | Dashed orange rectangle |
| `io` | Rectangle (teal) |
| `subprocess` | Rectangle (green) |

### Architecture template

| Type | Default style |
|---|---|
| `service` / `api` | Rectangle (purple) |
| `db` / `database` | Rectangle (green) |
| `queue` | Rectangle (yellow) |
| `cache` | Rectangle (orange) |
| `gateway` / `orchestrator` | Bold rectangle (red) |
| `frontend` | Rectangle (blue) |
| `user` / `actor` | Ellipse |
| `external` | Rectangle (light red) |
| `ml` / `ai` | Rectangle (purple haze) |
| `monitor` | Rectangle (green) |

> **Note:** No `diamond` shape exists in Excalidraw raw JSON. Decision nodes use a dashed orange rectangle as the canonical alternative.

---

## Development

### Scripts

```bash
npm run build        # Compile TypeScript → dist/
npm run dev          # Run directly via ts-node (no build needed)
npm test             # Run all tests (vitest)
npm run test:watch   # Watch mode
npm run lint         # Type-check without emitting
```

### Project structure

```
src/
  cli.ts              # Commander CLI entrypoint
  types/              # Shared TypeScript types (NodeStyle, EdgeStyle, etc.)
  parser/             # JSON + YAML input → Diagram object
  validator/          # Input validation (errors + warnings)
  normalizer/         # Defaults, ID cleanup, duplicate-edge detection
  layout/
    dag.ts            # Kahn's topological sort + BFS DAG layout
    grid.ts           # Grid layout
    arrow-router.ts   # Elbow arrow anchor + step point calculation
  renderer/
    elements.ts       # Shape / text / arrow element factories (with style merging)
    index.ts          # Full render orchestration
    seed.ts           # Deterministic ID hashing (FNV-1a)
  templates/
    index.ts          # flowchart + architecture template definitions
    themes.ts         # default / pastel / dark color overlays
  exporter/           # Assemble ExcalidrawFile, pre-flight check, write
  validator/
    preflight.ts      # Post-render element sanity checks
examples/
  simple-flowchart.json    # 5-node login flow
  styled-flowchart.json    # Payment flow with per-node/edge style overrides
  architecture.json        # 8-node 3-tier web app
  pipeline.yaml            # CI/CD pipeline (YAML format)
```

---

## Contributing

### 1. Fork and clone

```bash
git clone https://github.com/your-username/excalidraw-gen.git
cd excalidraw-gen
npm install
```

### 2. Create a branch

```bash
git checkout -b feat/your-feature-name
```

Use a descriptive prefix: `feat/`, `fix/`, `docs/`, `test/`, `refactor/`.

### 3. Make your changes

- Keep changes focused — one concern per PR
- Match the existing code style (TypeScript strict mode, no `any`)
- Do not add comments or docstrings to code you didn't change

### 4. Run tests and build

```bash
npm run build && npm test
```

Both must pass with zero errors before submitting.

### 5. Submit a pull request

Open a PR against `main` with a clear description of what changes and why.

### Adding a new template

1. Add a `TemplateDefinition` in `src/templates/index.ts` using `registerTemplate()`
2. Add theme overrides in `src/templates/themes.ts` if needed
3. Add an example JSON or YAML file under `examples/`
4. Add tests in `tests/renderer.test.ts`

### Adding a new layout engine

1. Implement `(diagram: Diagram) => LayoutNode[]` in `src/layout/`
2. Register it in `src/layout/index.ts` using `registerLayoutEngine()`
3. Add tests in `tests/layout.test.ts`

### Known Excalidraw raw JSON constraints

- No `type: "diamond"` — use dashed rectangles for decision nodes
- Labels require **two elements**: the shape with `boundElements` + a separate `text` with `containerId`
- Arrows must have `roughness: 0`, `roundness: null`, `elbowed: true`
- Arrow `x, y` is the **edge point** of the source shape, not the center
- `points[0]` is always `[0, 0]`; all other points are relative offsets

---

## License

[MIT](LICENSE)

