# DBML Schema Builder/Viewer — Design

## Overview

A personal/team development tool for designing and visualizing database schemas. Split-pane SvelteKit app: DBML code editor on the left, auto-laid-out schema diagram on the right.

## Architecture

Single-page SvelteKit app (Svelte 5, TypeScript, Tailwind CSS v4).

```
┌─────────────────────┬──────────────────────────┐
│                     │                          │
│   CodeMirror 6      │   SVG Schema Diagram     │
│   DBML Editor       │   (ELK auto-layout)      │
│                     │                          │
│   - Syntax HL       │   - Tables as rects      │
│   - Error markers   │   - Column rows          │
│   - Line numbers    │   - Relationship lines   │
│                     │   - Pan & zoom           │
│                     │                          │
├─────────────────────┤                          │
│  Error bar (if any) │                          │
└─────────────────────┴──────────────────────────┘
```

## Data Flow

```
DBML text (editor)
  → debounce (300ms)
  → @dbml/core parse
  → success: extract tables, columns, refs → ELK layout → SVG render
  → failure: show parse error in error bar + editor gutter markers
```

## Components

1. **`+page.svelte`** — Top-level layout, split pane, holds DBML source string as state
2. **`Editor.svelte`** — Wraps CodeMirror 6 with custom DBML language mode, binds to source string
3. **`Diagram.svelte`** — Takes parsed schema, runs ELK layout, renders SVG
4. **`ErrorBar.svelte`** — Shows parse errors below the editor

## Key Libraries

| Library | Purpose |
|---------|---------|
| `@dbml/core` | Parse DBML → structured schema |
| `codemirror` + extensions | Code editor with syntax highlighting |
| `elkjs` | Auto-layout algorithm (layered/hierarchical) |
| `d3-zoom` | Pan & zoom on the SVG diagram |

## SVG Table Rendering

Each table is an SVG `<g>` group:
- Header rect with table name (colored)
- Column rows showing: name, type, constraints (PK, NOT NULL, etc.)
- Ports on left/right edges at each column row for relationship line anchoring

Relationship lines are SVG paths (bezier curves) connecting ports between columns. Styled by relationship type (one-to-one, one-to-many, many-to-many) using different line endings (crow's foot notation or similar).

## DBML Syntax Highlighting

Custom CodeMirror 6 language mode (StreamParser) highlighting:
- Keywords: `Table`, `Ref`, `Enum`, `as`, `Note`, `indexes`
- Types: `int`, `varchar`, `timestamp`, `boolean`, `text`, etc.
- Constraints: `pk`, `not null`, `unique`, `increment`, `default`
- Strings, comments, and table/column references

## Reactive Updates

- Editor changes debounced at ~300ms
- On valid parse: ELK layout computed asynchronously, SVG re-rendered
- On parse error: error message displayed in error bar, editor gutter markers highlight error location
- Previous valid diagram remains visible during parse errors

## Pan & Zoom

- `d3-zoom` attached to SVG container
- Mouse wheel to zoom, click-drag to pan
- Fit-to-content on initial render / schema change
