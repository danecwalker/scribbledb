# Download Image Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the separate SVG/PNG toolbar buttons with a single "Download Image" button that opens a modal with format, theme, and background options.

**Architecture:** Add modal state and theme color maps to Diagram.svelte. Refactor `buildCleanSVG()` to accept theme/background options and remap colors via string replacement on the serialized SVG. Replace the two export buttons with one button + modal markup.

**Tech Stack:** SvelteKit 5, Svelte 5 runes, TailwindCSS, Canvas API (for PNG)

---

### Task 1: Add theme color maps and refactor `buildCleanSVG()`

**Files:**
- Modify: `src/lib/components/Diagram.svelte`

**Step 1: Add theme types and color maps**

After the existing constants (`HEADER_BG`, `BODY_BG`, line ~118), add:

```typescript
type ImageTheme = 'dark' | 'light';
type ImageBackground = 'solid' | 'transparent';

const THEME_COLORS = {
  dark: {
    canvasBg: '#11111b',
    headerBg: '#252538',
    bodyBg: '#1e1e2e',
    text: '#cdd6f4',
    mutedText: '#6c7086',
    subtleText: '#7f849c',
    border: '#313244',
    edge: '#585b70',
    pkText: '#f9e2af',
    accentBubbleBg: '#313244',
    accentBubbleBorder: '#45475a',
  },
  light: {
    canvasBg: '#eff1f5',
    headerBg: '#e6e9ef',
    bodyBg: '#ffffff',
    text: '#4c4f69',
    mutedText: '#8c8fa1',
    subtleText: '#7c7f93',
    border: '#ccd0da',
    edge: '#9ca0b0',
    pkText: '#df8e1d',
    accentBubbleBg: '#e6e9ef',
    accentBubbleBorder: '#ccd0da',
  },
} as const;
```

**Step 2: Refactor `buildCleanSVG()` to accept options**

Replace the existing `buildCleanSVG()` function (lines ~300-346) with:

```typescript
function buildCleanSVG(theme: ImageTheme = 'dark', background: ImageBackground = 'solid'): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const box = gEl.getBBox();
  const pad = 40;

  // Set viewBox to fit content with padding
  clone.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`);
  clone.setAttribute('width', String(box.width + pad * 2));
  clone.setAttribute('height', String(box.height + pad * 2));

  // Remove the dot-grid background rect (first <rect> child of svg)
  const bgRect = clone.querySelector(':scope > rect');
  if (bgRect) bgRect.remove();

  // Remove the <defs> with the dot-grid pattern
  const defs = clone.querySelector('defs');
  if (defs) defs.remove();

  // Add a solid background rect (or skip for transparent)
  if (background === 'solid') {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(box.x - pad));
    bg.setAttribute('y', String(box.y - pad));
    bg.setAttribute('width', String(box.width + pad * 2));
    bg.setAttribute('height', String(box.height + pad * 2));
    bg.setAttribute('fill', THEME_COLORS[theme].canvasBg);
    clone.insertBefore(bg, clone.firstChild);
  }

  // Reset the <g> transform to identity (viewBox handles positioning)
  const g = clone.querySelector('g');
  if (g) g.removeAttribute('transform');

  // Strip interactive attributes and animation elements
  clone.querySelectorAll('animate').forEach((el) => el.remove());
  clone.querySelectorAll('[style*="cursor"]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    el.setAttribute('style', style.replace(/cursor:\s*[^;]+;?/g, ''));
  });
  clone.querySelectorAll('[style*="transition"]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    el.setAttribute('style', style.replace(/transition:\s*[^;]+;?/g, ''));
  });

  // Add xmlns for standalone SVG
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  let svgString = new XMLSerializer().serializeToString(clone);

  // Remap colors for light theme
  if (theme === 'light') {
    const dark = THEME_COLORS.dark;
    const light = THEME_COLORS.light;
    svgString = svgString
      .replaceAll(dark.headerBg, light.headerBg)
      .replaceAll(dark.bodyBg, light.bodyBg)
      .replaceAll(dark.text, light.text)
      .replaceAll(dark.mutedText, light.mutedText)
      .replaceAll(dark.subtleText, light.subtleText)
      .replaceAll(dark.border, light.border)
      .replaceAll(dark.edge, light.edge)
      .replaceAll(dark.pkText, light.pkText)
      .replaceAll(dark.accentBubbleBg, light.accentBubbleBg)
      .replaceAll(dark.accentBubbleBorder, light.accentBubbleBorder);
  }

  return svgString;
}
```

**Step 3: Update `exportSVG()` and `exportPNG()` to pass options through**

Update the existing export functions so they still work (they will be called from the modal later, but keep them functional for now):

```typescript
function exportSVG(theme: ImageTheme = 'dark', background: ImageBackground = 'solid') {
  if (!svgEl || !gEl) return;
  const svgString = buildCleanSVG(theme, background);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, 'diagram.svg');
}

function exportPNG(theme: ImageTheme = 'dark', background: ImageBackground = 'solid') {
  if (!svgEl || !gEl) return;
  const svgString = buildCleanSVG(theme, background);
  const box = gEl.getBBox();
  const pad = 40;
  const scale = 2; // retina

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = (box.width + pad * 2) * scale;
    canvas.height = (box.height + pad * 2) * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, 'diagram.png');
    }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
}
```

**Step 4: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: no errors

**Step 5: Commit**

```bash
git add src/lib/components/Diagram.svelte
git commit -m "refactor: add theme/background options to SVG/PNG export"
```

---

### Task 2: Add modal state, markup, and replace toolbar buttons

**Files:**
- Modify: `src/lib/components/Diagram.svelte`

**Step 1: Add modal state**

After the existing export dropdown state (around line ~54), add:

```typescript
// Download Image modal state
let downloadModalOpen = $state(false);
let dlFormat = $state<'svg' | 'png'>('png');
let dlTheme = $state<ImageTheme>('dark');
let dlBackground = $state<ImageBackground>('solid');

function handleDownloadImage() {
  downloadModalOpen = false;
  if (dlFormat === 'svg') {
    exportSVG(dlTheme, dlBackground);
  } else {
    exportPNG(dlTheme, dlBackground);
  }
}
```

**Step 2: Replace SVG/PNG buttons with single Download Image button**

In the toolbar `<div>`, remove the two buttons:

```svelte
<!-- REMOVE THESE TWO BUTTONS -->
<button onclick={exportSVG} ...>SVG</button>
<button onclick={exportPNG} ...>PNG</button>
```

And replace with:

```svelte
<button
  onclick={() => downloadModalOpen = true}
  class="rounded bg-[#313244] px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
>
  Download Image
</button>
```

**Step 3: Add modal markup**

Add the modal markup right before the closing `</div>` of the container div (before `</div>` that closes `bind:this={containerEl}`). Place it after the `</svg>` tag:

```svelte
{#if downloadModalOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    onclick={(e) => { if (e.target === e.currentTarget) downloadModalOpen = false; }}
  >
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative rounded-lg bg-[#1e1e2e] border border-[#313244] shadow-2xl p-6 min-w-[320px]">
      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-sm font-semibold text-[#cdd6f4]">Download Image</h3>
        <button
          onclick={() => downloadModalOpen = false}
          class="text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Format -->
      <div class="mb-4">
        <label class="block text-xs text-[#a6adc8] mb-2">Format</label>
        <div class="flex gap-2">
          <button
            onclick={() => dlFormat = 'svg'}
            class="flex-1 rounded px-3 py-1.5 text-xs transition-colors {dlFormat === 'svg' ? 'bg-[#89b4fa] text-[#1e1e2e] font-semibold' : 'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]'}"
          >SVG</button>
          <button
            onclick={() => dlFormat = 'png'}
            class="flex-1 rounded px-3 py-1.5 text-xs transition-colors {dlFormat === 'png' ? 'bg-[#89b4fa] text-[#1e1e2e] font-semibold' : 'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]'}"
          >PNG</button>
        </div>
      </div>

      <!-- Theme -->
      <div class="mb-4">
        <label class="block text-xs text-[#a6adc8] mb-2">Theme</label>
        <div class="flex gap-2">
          <button
            onclick={() => dlTheme = 'dark'}
            class="flex-1 rounded px-3 py-1.5 text-xs transition-colors {dlTheme === 'dark' ? 'bg-[#89b4fa] text-[#1e1e2e] font-semibold' : 'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]'}"
          >Dark</button>
          <button
            onclick={() => dlTheme = 'light'}
            class="flex-1 rounded px-3 py-1.5 text-xs transition-colors {dlTheme === 'light' ? 'bg-[#89b4fa] text-[#1e1e2e] font-semibold' : 'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]'}"
          >Light</button>
        </div>
      </div>

      <!-- Background -->
      <div class="mb-5">
        <label class="block text-xs text-[#a6adc8] mb-2">Background</label>
        <div class="flex gap-2">
          <button
            onclick={() => dlBackground = 'solid'}
            class="flex-1 rounded px-3 py-1.5 text-xs transition-colors {dlBackground === 'solid' ? 'bg-[#89b4fa] text-[#1e1e2e] font-semibold' : 'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]'}"
          >Solid</button>
          <button
            onclick={() => dlBackground = 'transparent'}
            class="flex-1 rounded px-3 py-1.5 text-xs transition-colors {dlBackground === 'transparent' ? 'bg-[#89b4fa] text-[#1e1e2e] font-semibold' : 'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]'}"
          >Transparent</button>
        </div>
      </div>

      <!-- Download button -->
      <button
        onclick={handleDownloadImage}
        class="w-full rounded bg-[#89b4fa] px-4 py-2 text-sm font-semibold text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors"
      >
        Download
      </button>
    </div>
  </div>
{/if}
```

**Step 4: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: no errors

**Step 5: Commit**

```bash
git add src/lib/components/Diagram.svelte
git commit -m "feat: replace SVG/PNG buttons with Download Image modal"
```
