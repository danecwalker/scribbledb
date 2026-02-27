# Export SQL Dropdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a custom dropdown menu to the Diagram toolbar that exports DBML to MySQL, PostgreSQL, MSSQL, Oracle, DBML, and JSON formats via `ModelExporter.export()` from `@dbml/core`.

**Architecture:** Add an `exportDBML()` helper in `parser.ts` that takes source + format, returns the exported string. Pass `source` as a new prop to `Diagram.svelte`. Add a custom dropdown button with click-outside-to-close behavior in the diagram toolbar.

**Tech Stack:** SvelteKit 5, @dbml/core (Parser + ModelExporter), TailwindCSS

---

### Task 1: Add `exportDBML()` helper to parser.ts

**Files:**
- Modify: `src/lib/dbml/parser.ts`

**Step 1: Add ModelExporter import and export function**

Add to the top of `parser.ts`, after the existing `Parser` import:

```typescript
import { Parser, ModelExporter } from '@dbml/core';
```

Add at the bottom of the file:

```typescript
export type ExportFormat = 'mysql' | 'postgres' | 'oracle' | 'dbml' | 'mssql' | 'json';

export function exportDBML(source: string, format: ExportFormat): string {
  const parser = new Parser();
  const database = parser.parse(source, 'dbml');
  return ModelExporter.export(database, format);
}
```

**Step 2: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: no errors in parser.ts

**Step 3: Commit**

```bash
git add src/lib/dbml/parser.ts
git commit -m "feat: add exportDBML helper for SQL format export"
```

---

### Task 2: Pass `source` prop to Diagram component

**Files:**
- Modify: `src/lib/components/Diagram.svelte` (Props interface)
- Modify: `src/routes/+page.svelte` (pass source prop)

**Step 1: Add `source` and `hasErrors` props to Diagram**

In `Diagram.svelte`, update the `Props` interface and destructuring (lines 8-14):

```typescript
interface Props {
  layout: LayoutResult | null;
  source: string;
  hasErrors: boolean;
  onlayout: () => void;
  onshare: () => Promise<void>;
}

let { layout, source, hasErrors, onlayout, onshare }: Props = $props();
```

**Step 2: Pass `source` and `hasErrors` from +page.svelte**

In `+page.svelte` line 472, update the Diagram usage:

```svelte
<Diagram {layout} {source} hasErrors={parseErrors.length > 0} onlayout={runLayout} onshare={shareDiagram} />
```

**Step 3: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: no errors

**Step 4: Commit**

```bash
git add src/lib/components/Diagram.svelte src/routes/+page.svelte
git commit -m "feat: pass source and hasErrors props to Diagram"
```

---

### Task 3: Add custom dropdown menu and export logic to Diagram

**Files:**
- Modify: `src/lib/components/Diagram.svelte`

**Step 1: Add imports and export format config**

Add import at top of `<script>`:

```typescript
import { exportDBML, type ExportFormat } from '$lib/dbml/parser';
```

Add after the existing state declarations (after line ~38):

```typescript
// Export dropdown state
let exportOpen = $state(false);
let exportBtnEl: HTMLDivElement;

const EXPORT_FORMATS: { format: ExportFormat; label: string; ext: string }[] = [
  { format: 'postgres', label: 'PostgreSQL', ext: '.sql' },
  { format: 'mysql', label: 'MySQL', ext: '.sql' },
  { format: 'mssql', label: 'MSSQL', ext: '.sql' },
  { format: 'oracle', label: 'Oracle', ext: '.sql' },
  { format: 'dbml', label: 'DBML', ext: '.dbml' },
  { format: 'json', label: 'JSON', ext: '.json' },
];

function handleExport(format: ExportFormat, ext: string) {
  exportOpen = false;
  try {
    const result = exportDBML(source, format);
    const mime = ext === '.json' ? 'application/json' : 'text/plain';
    const blob = new Blob([result], { type: `${mime};charset=utf-8` });
    triggerDownload(blob, `schema${ext}`);
  } catch (e: any) {
    console.error('Export failed:', e);
  }
}

// Close dropdown on click outside
$effect(() => {
  if (!exportOpen) return;
  const onClick = (e: MouseEvent) => {
    if (exportBtnEl && !exportBtnEl.contains(e.target as Node)) {
      exportOpen = false;
    }
  };
  window.addEventListener('click', onClick, true);
  return () => window.removeEventListener('click', onClick, true);
});
```

**Step 2: Add dropdown button to toolbar**

In the toolbar `<div>` (line 395), add the Export SQL dropdown **before** the SVG button. Insert between the Fit button and SVG button:

```svelte
<!-- Export SQL dropdown -->
<div class="relative" bind:this={exportBtnEl}>
  <button
    onclick={() => exportOpen = !exportOpen}
    disabled={hasErrors}
    class="rounded bg-[#313244] px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    Export SQL
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
  {#if exportOpen}
    <div class="absolute top-full right-0 mt-1 rounded bg-[#313244] border border-[#45475a] shadow-lg overflow-hidden z-20 min-w-[140px]">
      {#each EXPORT_FORMATS as { format, label, ext }}
        <button
          onclick={() => handleExport(format, ext)}
          class="block w-full text-left px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
        >
          {label}
        </button>
      {/each}
    </div>
  {/if}
</div>
```

**Step 3: Verify it compiles and renders**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: no errors

Run: `npm run dev` and visually verify the dropdown works

**Step 4: Commit**

```bash
git add src/lib/components/Diagram.svelte
git commit -m "feat: add Export SQL dropdown with DB format export"
```
