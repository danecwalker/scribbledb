# DBML Schema Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a split-pane DBML schema builder with a CodeMirror 6 editor on the left and an auto-laid-out SVG schema diagram on the right.

**Architecture:** SvelteKit single-page app. DBML text is parsed with `@dbml/core`, laid out with ELK.js, and rendered as SVG. Live reactive updates with debouncing. Pan & zoom via d3-zoom.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Tailwind CSS v4, CodeMirror 6, @dbml/core, elkjs, d3-zoom

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install runtime dependencies**

Run:
```bash
bun add @dbml/core elkjs d3-zoom d3-selection codemirror @codemirror/state @codemirror/view @codemirror/language @codemirror/commands @codemirror/search @codemirror/autocomplete @codemirror/lint
```

**Step 2: Install TypeScript type definitions**

Run:
```bash
bun add -d @types/d3-zoom @types/d3-selection
```

**Step 3: Verify dependencies installed**

Run:
```bash
bun run dev
```
Expected: Dev server starts without errors. Stop it after verifying.

**Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add dependencies for DBML schema builder"
```

---

### Task 2: DBML parser utility

**Files:**
- Create: `src/lib/dbml/parser.ts`

**Step 1: Create the DBML parser module**

This module wraps `@dbml/core` and extracts a normalized schema structure suitable for layout and rendering.

```typescript
// src/lib/dbml/parser.ts
import { Parser } from '@dbml/core';

export interface SchemaColumn {
  name: string;
  type: string;
  pk: boolean;
  unique: boolean;
  notNull: boolean;
  increment: boolean;
  defaultValue: string | null;
  note: string | null;
}

export interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  note: string | null;
  headerColor: string | null;
}

export interface SchemaRef {
  name: string;
  fromSchema: string;
  fromTable: string;
  fromColumns: string[];
  fromRelation: string;
  toSchema: string;
  toTable: string;
  toColumns: string[];
  toRelation: string;
  onDelete: string | null;
  onUpdate: string | null;
}

export interface SchemaEnum {
  name: string;
  schema: string;
  values: { name: string; note: string | null }[];
}

export interface ParsedSchema {
  tables: SchemaTable[];
  refs: SchemaRef[];
  enums: SchemaEnum[];
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
}

export type ParseResult =
  | { ok: true; schema: ParsedSchema }
  | { ok: false; errors: ParseError[] };

export function parseDBML(source: string): ParseResult {
  try {
    const parser = new Parser();
    const database = parser.parse(source, 'dbml');

    const tables: SchemaTable[] = [];
    const refs: SchemaRef[] = [];
    const enums: SchemaEnum[] = [];

    for (const schema of database.schemas) {
      for (const table of schema.tables) {
        tables.push({
          name: table.name,
          schema: schema.name,
          columns: table.fields.map((field: any) => ({
            name: field.name,
            type: field.type?.type_name ?? String(field.type),
            pk: field.pk ?? false,
            unique: field.unique ?? false,
            notNull: field.not_null ?? false,
            increment: field.increment ?? false,
            defaultValue: field.dbdefault?.value != null ? String(field.dbdefault.value) : null,
            note: field.note || null,
          })),
          note: table.note || null,
          headerColor: table.headerColor || null,
        });
      }

      for (const ref of schema.refs) {
        const [ep1, ep2] = ref.endpoints;
        refs.push({
          name: ref.name || '',
          fromSchema: ep1.schemaName || schema.name,
          fromTable: ep1.tableName,
          fromColumns: ep1.fieldNames,
          fromRelation: ep1.relation,
          toSchema: ep2.schemaName || schema.name,
          toTable: ep2.tableName,
          toColumns: ep2.fieldNames,
          toRelation: ep2.relation,
          onDelete: ref.onDelete || null,
          onUpdate: ref.onUpdate || null,
        });
      }

      for (const en of schema.enums) {
        enums.push({
          name: en.name,
          schema: schema.name,
          values: en.values.map((v: any) => ({
            name: v.name,
            note: v.note || null,
          })),
        });
      }
    }

    return { ok: true, schema: { tables, refs, enums } };
  } catch (e: any) {
    if (e.diags && Array.isArray(e.diags)) {
      const errors: ParseError[] = e.diags.map((diag: any) => ({
        message: diag.message,
        line: diag.location?.start?.line ?? 1,
        column: diag.location?.start?.column ?? 1,
        severity: diag.type ?? 'error',
      }));
      return { ok: false, errors };
    }
    return {
      ok: false,
      errors: [{ message: e.message ?? 'Unknown parse error', line: 1, column: 1, severity: 'error' }],
    };
  }
}
```

**Step 2: Verify it compiles**

Run:
```bash
bun run check
```
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/lib/dbml/parser.ts
git commit -m "feat: add DBML parser utility with typed schema output"
```

---

### Task 3: DBML syntax highlighting for CodeMirror

**Files:**
- Create: `src/lib/dbml/lang-dbml.ts`

**Step 1: Create the DBML StreamParser language mode**

```typescript
// src/lib/dbml/lang-dbml.ts
import { StreamLanguage, type StreamParser } from '@codemirror/language';

interface DBMLState {
  inString: boolean;
  inSingleString: boolean;
  inBlockComment: boolean;
  inNote: boolean;
}

const dbmlParser: StreamParser<DBMLState> = {
  name: 'dbml',

  startState(): DBMLState {
    return { inString: false, inSingleString: false, inBlockComment: false, inNote: false };
  },

  copyState(state: DBMLState): DBMLState {
    return { ...state };
  },

  token(stream, state): string | null {
    // Block comment
    if (state.inBlockComment) {
      if (stream.match('*/')) {
        state.inBlockComment = false;
      } else {
        stream.next();
      }
      return 'blockComment';
    }

    // Double-quoted string
    if (state.inString) {
      if (stream.skipTo('"')) {
        stream.next();
        state.inString = false;
      } else {
        stream.skipToEnd();
      }
      return 'string';
    }

    // Single-quoted string
    if (state.inSingleString) {
      if (stream.skipTo("'")) {
        stream.next();
        state.inSingleString = false;
      } else {
        stream.skipToEnd();
      }
      return 'string';
    }

    // Multi-line note content
    if (state.inNote) {
      if (stream.match("'''")) {
        state.inNote = false;
        return 'string';
      }
      stream.next();
      return 'string';
    }

    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Line comment
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // Block comment start
    if (stream.match('/*')) {
      state.inBlockComment = true;
      return 'blockComment';
    }

    // Multi-line note
    if (stream.match("'''")) {
      state.inNote = true;
      return 'string';
    }

    // Double-quoted string
    if (stream.peek() === '"') {
      stream.next();
      state.inString = true;
      return 'string';
    }

    // Single-quoted string
    if (stream.peek() === "'") {
      stream.next();
      state.inSingleString = true;
      return 'string';
    }

    // Keywords (block-level declarations)
    if (stream.match(/^(Table|Ref|Enum|TableGroup|Project|Note)\b/)) {
      return 'keyword';
    }

    // Sub-keywords
    if (stream.match(/^(indexes|as|null)\b/)) {
      return 'keyword';
    }

    // Constraints (inside brackets)
    if (stream.match(/^(pk|primary\s+key|not\s+null|unique|increment|default|ref|note)\b/i)) {
      return 'atom';
    }

    // Relationship operators
    if (stream.match(/^(<>|[<>\-])/) && !stream.match(/^\w/, false)) {
      return 'operator';
    }

    // Numbers
    if (stream.match(/^\d+(\.\d+)?/)) {
      return 'number';
    }

    // Common SQL types
    if (stream.match(/^(int|integer|bigint|smallint|tinyint|serial|bigserial|float|double|real|decimal|numeric|boolean|bool|varchar|char|text|blob|bytea|date|time|datetime|timestamp|timestamptz|uuid|json|jsonb|xml|money|inet|cidr|macaddr|bit|varbit|interval|point|line|polygon|circle|box|path|array)\b/i)) {
      return 'typeName';
    }

    // Brackets
    if (stream.match(/^[{}\[\]()]/)) {
      return 'bracket';
    }

    // Dot accessor
    if (stream.peek() === '.') {
      stream.next();
      return 'operator';
    }

    // Colon
    if (stream.peek() === ':') {
      stream.next();
      return 'operator';
    }

    // Identifiers
    if (stream.match(/^[a-zA-Z_]\w*/)) {
      return 'variableName';
    }

    // Consume any unrecognized character
    stream.next();
    return null;
  },
};

export const dbmlLanguage = StreamLanguage.define(dbmlParser);
```

**Step 2: Verify it compiles**

Run:
```bash
bun run check
```
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/lib/dbml/lang-dbml.ts
git commit -m "feat: add DBML syntax highlighting for CodeMirror 6"
```

---

### Task 4: Editor component

**Files:**
- Create: `src/lib/components/Editor.svelte`

**Step 1: Create the CodeMirror editor component**

```svelte
<!-- src/lib/components/Editor.svelte -->
<script lang="ts">
  import { EditorView, basicSetup } from 'codemirror';
  import { EditorState } from '@codemirror/state';
  import { linter, lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
  import { dbmlLanguage } from '$lib/dbml/lang-dbml';
  import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
  import { tags } from '@lezer/highlight';

  interface Props {
    value?: string;
    diagnostics?: Diagnostic[];
    onchange?: (value: string) => void;
  }

  let { value = $bindable(''), diagnostics = [], onchange }: Props = $props();

  let container: HTMLDivElement;
  let view: EditorView | undefined;
  let internalUpdate = false;

  const highlightStyle = syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: '#c792ea', fontWeight: 'bold' },
      { tag: tags.comment, color: '#637777', fontStyle: 'italic' },
      { tag: tags.blockComment, color: '#637777', fontStyle: 'italic' },
      { tag: tags.string, color: '#c3e88d' },
      { tag: tags.number, color: '#f78c6c' },
      { tag: tags.variableName, color: '#82aaff' },
      { tag: tags.typeName, color: '#ffcb6b' },
      { tag: tags.atom, color: '#f07178' },
      { tag: tags.operator, color: '#89ddff' },
      { tag: tags.bracket, color: '#d4d4d4' },
    ])
  );

  const darkTheme = EditorView.theme({
    '&': {
      backgroundColor: '#1e1e2e',
      color: '#cdd6f4',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#f5e0dc',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: '14px',
    },
    '.cm-gutters': {
      backgroundColor: '#181825',
      color: '#6c7086',
      borderRight: '1px solid #313244',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#313244',
    },
    '.cm-activeLine': {
      backgroundColor: '#313244',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#f5e0dc',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#45475a',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
  });

  $effect(() => {
    view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          dbmlLanguage,
          highlightStyle,
          darkTheme,
          lintGutter(),
          linter(() => []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              internalUpdate = true;
              const newValue = update.state.doc.toString();
              value = newValue;
              onchange?.(newValue);
              internalUpdate = false;
            }
          }),
        ],
      }),
      parent: container,
    });

    return () => {
      view?.destroy();
      view = undefined;
    };
  });

  // Sync external value changes into editor
  $effect(() => {
    if (!view || internalUpdate) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  });

  // Push diagnostics into editor
  $effect(() => {
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, diagnostics));
  });
</script>

<div bind:this={container} class="h-full w-full overflow-hidden"></div>
```

**Step 2: Verify it compiles**

Run:
```bash
bun run check
```
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/lib/components/Editor.svelte
git commit -m "feat: add CodeMirror editor component with DBML syntax highlighting"
```

---

### Task 5: ELK layout utility

**Files:**
- Create: `src/lib/dbml/layout.ts`

**Step 1: Create the ELK layout module**

This converts our parsed schema into ELK graph format, runs the layout, and returns positioned nodes and edges.

```typescript
// src/lib/dbml/layout.ts
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ParsedSchema, SchemaTable, SchemaRef } from './parser';

const elk = new ELK();

// Layout constants
const TABLE_HEADER_HEIGHT = 36;
const COLUMN_ROW_HEIGHT = 28;
const TABLE_MIN_WIDTH = 200;
const CHAR_WIDTH = 8; // approximate character width for column text
const TABLE_PADDING_X = 24; // horizontal padding inside table

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  table: SchemaTable;
}

export interface LayoutPort {
  nodeId: string;
  columnName: string;
  x: number; // absolute x
  y: number; // absolute y
  side: 'left' | 'right';
}

export interface LayoutEdge {
  id: string;
  ref: SchemaRef;
  points: { x: number; y: number }[];
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

function estimateTableWidth(table: SchemaTable): number {
  let maxLen = table.name.length;
  for (const col of table.columns) {
    const constraintParts: string[] = [];
    if (col.pk) constraintParts.push('PK');
    if (col.unique) constraintParts.push('UQ');
    if (col.notNull) constraintParts.push('NN');
    if (col.increment) constraintParts.push('AI');
    const constraintStr = constraintParts.length > 0 ? `  ${constraintParts.join(' ')}` : '';
    const lineLen = col.name.length + col.type.length + 3 + constraintStr.length;
    if (lineLen > maxLen) maxLen = lineLen;
  }
  return Math.max(TABLE_MIN_WIDTH, maxLen * CHAR_WIDTH + TABLE_PADDING_X * 2);
}

function tableHeight(table: SchemaTable): number {
  return TABLE_HEADER_HEIGHT + table.columns.length * COLUMN_ROW_HEIGHT;
}

function tableNodeId(table: SchemaTable): string {
  return `${table.schema}.${table.name}`;
}

function portId(table: SchemaTable, columnName: string, side: 'left' | 'right'): string {
  return `${tableNodeId(table)}.${columnName}.${side}`;
}

export async function computeLayout(schema: ParsedSchema): Promise<LayoutResult> {
  // Build lookup for quick table finding
  const tableMap = new Map<string, SchemaTable>();
  for (const t of schema.tables) {
    tableMap.set(`${t.schema}.${t.name}`, t);
  }

  // Build ELK children (table nodes with ports)
  const children = schema.tables.map((table) => {
    const width = estimateTableWidth(table);
    const height = tableHeight(table);

    // Create ports for each column (both left and right side)
    const ports: any[] = [];
    table.columns.forEach((col, i) => {
      const portY = TABLE_HEADER_HEIGHT + i * COLUMN_ROW_HEIGHT + COLUMN_ROW_HEIGHT / 2;
      ports.push({
        id: portId(table, col.name, 'right'),
        width: 8,
        height: 8,
        layoutOptions: { 'elk.port.side': 'EAST' },
        properties: { 'org.eclipse.elk.port.index': String(i) },
      });
      ports.push({
        id: portId(table, col.name, 'left'),
        width: 8,
        height: 8,
        layoutOptions: { 'elk.port.side': 'WEST' },
        properties: { 'org.eclipse.elk.port.index': String(i) },
      });
    });

    return {
      id: tableNodeId(table),
      width,
      height,
      layoutOptions: {
        'elk.portConstraints': 'FIXED_SIDE',
        'elk.portAlignment.default': 'CENTER',
      },
      ports,
    };
  });

  // Build ELK edges from refs
  const edges = schema.refs.map((ref, i) => {
    const fromKey = `${ref.fromSchema}.${ref.fromTable}`;
    const toKey = `${ref.toSchema}.${ref.toTable}`;
    const fromTable = tableMap.get(fromKey);
    const toTable = tableMap.get(toKey);

    if (!fromTable || !toTable) {
      return null;
    }

    const fromCol = ref.fromColumns[0] || '';
    const toCol = ref.toColumns[0] || '';

    return {
      id: `e${i}`,
      sources: [portId(fromTable, fromCol, 'right')],
      targets: [portId(toTable, toCol, 'left')],
    };
  }).filter(Boolean);

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.padding': '[top=30, left=30, bottom=30, right=30]',
    },
    children,
    edges,
  };

  const result = await elk.layout(graph);

  // Extract positioned nodes
  const nodes: LayoutNode[] = (result.children || []).map((child: any) => {
    const table = tableMap.get(child.id)!;
    return {
      id: child.id,
      x: child.x,
      y: child.y,
      width: child.width,
      height: child.height,
      table,
    };
  });

  // Extract edges with their routed points
  const layoutEdges: LayoutEdge[] = (result.edges || []).map((edge: any, i: number) => {
    const points: { x: number; y: number }[] = [];
    if (edge.sections) {
      for (const section of edge.sections) {
        points.push(section.startPoint);
        if (section.bendPoints) {
          points.push(...section.bendPoints);
        }
        points.push(section.endPoint);
      }
    }
    return {
      id: edge.id,
      ref: schema.refs[i],
      points,
    };
  });

  return {
    nodes,
    edges: layoutEdges,
    width: result.width || 0,
    height: result.height || 0,
  };
}
```

**Step 2: Verify it compiles**

Run:
```bash
bun run check
```
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/lib/dbml/layout.ts
git commit -m "feat: add ELK layout utility for schema diagram positioning"
```

---

### Task 6: SVG Diagram component

**Files:**
- Create: `src/lib/components/Diagram.svelte`

**Step 1: Create the SVG diagram rendering component**

This component takes a `LayoutResult` and renders tables as SVG rectangles with columns, plus relationship lines.

```svelte
<!-- src/lib/components/Diagram.svelte -->
<script lang="ts">
  import type { LayoutResult, LayoutNode, LayoutEdge } from '$lib/dbml/layout';
  import { zoom, zoomIdentity } from 'd3-zoom';
  import { select } from 'd3-selection';

  interface Props {
    layout: LayoutResult | null;
  }

  let { layout }: Props = $props();

  let svgEl: SVGSVGElement;
  let gEl: SVGGElement;
  let zoomBehavior: ReturnType<typeof zoom>;

  const HEADER_HEIGHT = 36;
  const ROW_HEIGHT = 28;
  const PADDING_X = 12;

  // Table color palette
  const TABLE_COLORS = [
    '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8',
    '#cba6f7', '#fab387', '#94e2d5', '#74c7ec',
  ];

  function getTableColor(index: number): string {
    return TABLE_COLORS[index % TABLE_COLORS.length];
  }

  function buildEdgePath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  function getRelationLabel(ref: LayoutEdge['ref']): { from: string; to: string } {
    const map: Record<string, string> = {
      '<': '*',
      '>': '*',
      '-': '1',
      '<>': '*',
    };
    return {
      from: map[ref.fromRelation] || '',
      to: map[ref.toRelation] || '',
    };
  }

  function fitToContent(padding = 40) {
    if (!svgEl || !gEl || !zoomBehavior) return;
    const box = gEl.getBBox();
    if (box.width === 0 || box.height === 0) return;

    const svgWidth = svgEl.clientWidth;
    const svgHeight = svgEl.clientHeight;

    const scale = Math.min(
      (svgWidth - padding * 2) / box.width,
      (svgHeight - padding * 2) / box.height,
      1 // don't zoom in beyond 100%
    );

    const tx = svgWidth / 2 - scale * (box.x + box.width / 2);
    const ty = svgHeight / 2 - scale * (box.y + box.height / 2);

    const transform = zoomIdentity.translate(tx, ty).scale(scale);
    select(svgEl).transition().duration(300).call(zoomBehavior.transform, transform);
  }

  // Set up zoom
  $effect(() => {
    if (!svgEl || !gEl) return;

    zoomBehavior = zoom()
      .scaleExtent([0.05, 4])
      .on('zoom', (event) => {
        select(gEl).attr('transform', event.transform);
      });

    select(svgEl).call(zoomBehavior as any);

    return () => {
      select(svgEl).on('.zoom', null);
    };
  });

  // Fit to content when layout changes
  $effect(() => {
    if (!layout || !svgEl || !gEl) return;
    // Use a microtask to let SVG render first
    queueMicrotask(() => fitToContent());
  });
</script>

<div class="relative h-full w-full bg-[#11111b]">
  <button
    onclick={() => fitToContent()}
    class="absolute top-3 right-3 z-10 rounded bg-[#313244] px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
  >
    Fit
  </button>

  <svg bind:this={svgEl} class="h-full w-full">
    <g bind:this={gEl}>
      {#if layout}
        <!-- Edges (render behind tables) -->
        {#each layout.edges as edge}
          <path
            d={buildEdgePath(edge.points)}
            fill="none"
            stroke="#585b70"
            stroke-width="1.5"
          />
        {/each}

        <!-- Table nodes -->
        {#each layout.nodes as node, i}
          <g transform="translate({node.x}, {node.y})">
            <!-- Table background -->
            <rect
              width={node.width}
              height={node.height}
              rx="6"
              ry="6"
              fill="#1e1e2e"
              stroke="#313244"
              stroke-width="1"
            />

            <!-- Header background -->
            <rect
              width={node.width}
              height={HEADER_HEIGHT}
              rx="6"
              ry="6"
              fill={node.table.headerColor || getTableColor(i)}
              opacity="0.85"
            />
            <!-- Header bottom square corners -->
            <rect
              x="0"
              y={HEADER_HEIGHT - 6}
              width={node.width}
              height="6"
              fill={node.table.headerColor || getTableColor(i)}
              opacity="0.85"
            />

            <!-- Table name -->
            <text
              x={node.width / 2}
              y={HEADER_HEIGHT / 2}
              text-anchor="middle"
              dominant-baseline="central"
              fill="#1e1e2e"
              font-weight="bold"
              font-size="14"
              font-family="'JetBrains Mono', 'Fira Code', monospace"
            >
              {node.table.name}
            </text>

            <!-- Columns -->
            {#each node.table.columns as col, ci}
              {@const rowY = HEADER_HEIGHT + ci * ROW_HEIGHT}

              <!-- Row separator -->
              {#if ci > 0}
                <line
                  x1="0"
                  y1={rowY}
                  x2={node.width}
                  y2={rowY}
                  stroke="#313244"
                  stroke-width="0.5"
                />
              {/if}

              <!-- Column name -->
              <text
                x={PADDING_X}
                y={rowY + ROW_HEIGHT / 2}
                dominant-baseline="central"
                fill={col.pk ? '#f9e2af' : '#cdd6f4'}
                font-weight={col.pk ? 'bold' : 'normal'}
                font-size="12"
                font-family="'JetBrains Mono', 'Fira Code', monospace"
              >
                {col.pk ? '🔑 ' : ''}{col.name}
              </text>

              <!-- Column type -->
              <text
                x={node.width - PADDING_X}
                y={rowY + ROW_HEIGHT / 2}
                text-anchor="end"
                dominant-baseline="central"
                fill="#6c7086"
                font-size="11"
                font-family="'JetBrains Mono', 'Fira Code', monospace"
              >
                {col.type}
              </text>
            {/each}
          </g>
        {/each}
      {/if}
    </g>
  </svg>
</div>
```

**Step 2: Verify it compiles**

Run:
```bash
bun run check
```
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/lib/components/Diagram.svelte
git commit -m "feat: add SVG diagram component with table rendering and pan/zoom"
```

---

### Task 7: ErrorBar component

**Files:**
- Create: `src/lib/components/ErrorBar.svelte`

**Step 1: Create the error bar component**

```svelte
<!-- src/lib/components/ErrorBar.svelte -->
<script lang="ts">
  import type { ParseError } from '$lib/dbml/parser';

  interface Props {
    errors: ParseError[];
  }

  let { errors }: Props = $props();
</script>

{#if errors.length > 0}
  <div class="border-t border-[#f38ba8]/30 bg-[#1e1e2e] px-4 py-2 text-xs text-[#f38ba8]">
    {#each errors as error}
      <div class="flex gap-2">
        <span class="text-[#6c7086]">Ln {error.line}, Col {error.column}</span>
        <span>{error.message}</span>
      </div>
    {/each}
  </div>
{/if}
```

**Step 2: Commit**

```bash
git add src/lib/components/ErrorBar.svelte
git commit -m "feat: add error bar component for parse errors"
```

---

### Task 8: Wire everything together in the page

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/layout.css`

**Step 1: Update layout.css for full-height layout**

Replace the contents of `src/routes/layout.css` with:

```css
@import 'tailwindcss';

html, body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
```

**Step 2: Build the main page**

Replace the contents of `src/routes/+page.svelte` with:

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import Editor from '$lib/components/Editor.svelte';
  import Diagram from '$lib/components/Diagram.svelte';
  import ErrorBar from '$lib/components/ErrorBar.svelte';
  import { parseDBML, type ParseError } from '$lib/dbml/parser';
  import { computeLayout, type LayoutResult } from '$lib/dbml/layout';
  import type { Diagnostic } from '@codemirror/lint';

  const DEFAULT_DBML = `Table users {
  id integer [pk, increment]
  username varchar(255) [unique, not null]
  email varchar(255) [unique, not null]
  role varchar [default: 'user']
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id integer [pk, increment]
  title varchar(255) [not null]
  body text
  user_id integer [not null]
  status varchar [default: 'draft']
  created_at timestamp [default: \`now()\`]
}

Table comments {
  id integer [pk, increment]
  body text [not null]
  post_id integer [not null]
  user_id integer [not null]
  created_at timestamp [default: \`now()\`]
}

Ref: posts.user_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id`;

  let source = $state(DEFAULT_DBML);
  let layout: LayoutResult | null = $state(null);
  let parseErrors: ParseError[] = $state([]);
  let diagnostics: Diagnostic[] = $state([]);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function handleSourceChange(newSource: string) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateDiagram(newSource);
    }, 300);
  }

  async function updateDiagram(dbml: string) {
    const result = parseDBML(dbml);

    if (result.ok) {
      parseErrors = [];
      diagnostics = [];
      try {
        layout = await computeLayout(result.schema);
      } catch (e) {
        console.error('Layout error:', e);
      }
    } else {
      parseErrors = result.errors;
      diagnostics = result.errors.map((err) => {
        // Convert line/col to character offset
        const lines = dbml.split('\n');
        let offset = 0;
        for (let i = 0; i < err.line - 1 && i < lines.length; i++) {
          offset += lines[i].length + 1;
        }
        offset += Math.max(0, err.column - 1);

        return {
          from: offset,
          to: Math.min(offset + 1, dbml.length),
          severity: err.severity === 'warning' ? 'warning' : 'error',
          message: err.message,
        } satisfies Diagnostic;
      });
    }
  }

  // Initial render
  $effect(() => {
    updateDiagram(source);
  });
</script>

<svelte:head>
  <title>DBML Schema Builder</title>
</svelte:head>

<div class="flex h-screen w-screen">
  <!-- Left: Editor panel -->
  <div class="flex w-[45%] min-w-[300px] flex-col border-r border-[#313244]">
    <div class="flex-1 overflow-hidden">
      <Editor bind:value={source} {diagnostics} onchange={handleSourceChange} />
    </div>
    <ErrorBar errors={parseErrors} />
  </div>

  <!-- Right: Diagram panel -->
  <div class="flex-1">
    <Diagram {layout} />
  </div>
</div>
```

**Step 3: Verify it works**

Run:
```bash
bun run dev
```
Expected: Open browser, see split pane with DBML editor on left and rendered schema diagram on right. Editing DBML should update the diagram after a short delay.

**Step 4: Verify no type errors**

Run:
```bash
bun run check
```
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/routes/+page.svelte src/routes/layout.css
git commit -m "feat: wire up split-pane DBML schema builder page"
```

---

### Task 9: Resizable split pane

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add a draggable divider between the editor and diagram panels**

Add a resizable divider between the two panels. Track the width percentage in state. Handle mousedown on the divider, then mousemove/mouseup on the document to resize.

In `+page.svelte`, add this state and these handlers before the template:

```typescript
let panelWidth = $state(45); // percentage
let isDragging = $state(false);

function onDividerMouseDown(e: MouseEvent) {
  e.preventDefault();
  isDragging = true;

  const onMouseMove = (e: MouseEvent) => {
    const pct = (e.clientX / window.innerWidth) * 100;
    panelWidth = Math.max(20, Math.min(80, pct));
  };

  const onMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
```

Update the template to use `panelWidth` and add the divider:

```svelte
<div class="flex h-screen w-screen" class:select-none={isDragging}>
  <!-- Left: Editor panel -->
  <div class="flex flex-col border-r border-[#313244] overflow-hidden" style="width: {panelWidth}%">
    <div class="flex-1 overflow-hidden">
      <Editor bind:value={source} {diagnostics} onchange={handleSourceChange} />
    </div>
    <ErrorBar errors={parseErrors} />
  </div>

  <!-- Drag handle -->
  <div
    class="w-1 cursor-col-resize bg-[#313244] hover:bg-[#585b70] transition-colors flex-shrink-0"
    onmousedown={onDividerMouseDown}
    role="separator"
    aria-orientation="vertical"
  ></div>

  <!-- Right: Diagram panel -->
  <div class="flex-1 overflow-hidden">
    <Diagram {layout} />
  </div>
</div>
```

**Step 2: Verify it works**

Run:
```bash
bun run dev
```
Expected: Dragging the divider resizes the editor and diagram panels.

**Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add resizable split pane divider"
```

---

### Task 10: Final polish and smoke test

**Step 1: Full smoke test**

Run:
```bash
bun run dev
```

Test the following manually:
1. Editor loads with sample DBML and syntax highlighting is visible
2. Diagram renders tables with columns, types, and relationship lines
3. Editing DBML updates the diagram after ~300ms
4. Introducing a syntax error shows error in the error bar and marks in the editor gutter
5. Fixing the error restores the diagram
6. Mouse wheel zooms the diagram, click-drag pans it
7. "Fit" button resets zoom to show all tables
8. Dragging the divider resizes both panels

**Step 2: Type check**

Run:
```bash
bun run check
```
Expected: No TypeScript errors.

**Step 3: Build check**

Run:
```bash
bun run build
```
Expected: Production build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: DBML schema builder - initial release"
```
