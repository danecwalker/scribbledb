<!-- src/lib/components/Diagram.svelte -->
<script lang="ts">
  import { headerHeight, wrapNoteText, NOTE_LINE_HEIGHT } from '$lib/dbml/layout';
  import type { LayoutResult, LayoutNode, LayoutEdge, LayoutGroup } from '$lib/dbml/layout';
  import { exportDBML, type ExportFormat } from '$lib/dbml/parser';
  import { zoom, zoomIdentity } from 'd3-zoom';
  import { select } from 'd3-selection';

  interface Props {
    layout: LayoutResult | null;
    source: string;
    hasErrors: boolean;
    onlayout: () => void;
    onshare: () => Promise<void>;
  }

  let { layout, source, hasErrors, onlayout, onshare }: Props = $props();

  // Share button "Copied!" toast state
  let shareCopied = $state(false);

  async function handleShare() {
    await onshare();
    shareCopied = true;
    setTimeout(() => shareCopied = false, 2000);
  }

  let svgEl: SVGSVGElement;
  let gEl: SVGGElement;
  let containerEl: HTMLDivElement;
  let zoomBehavior: ReturnType<typeof zoom>;

  // Tooltip state
  let tooltip = $state<{ text: string; x: number; y: number } | null>(null);

  // Hovered edge state
  let hoveredEdgeId = $state<string | null>(null);

  // Node drag offsets: nodeId -> { dx, dy }
  let nodeOffsets: Record<string, { dx: number; dy: number }> = $state({});
  let draggingNodeId = $state<string | null>(null);

  // Reset offsets when layout changes (e.g. auto layout button)
  let prevLayout: LayoutResult | null = null;
  $effect(() => {
    if (layout && layout !== prevLayout) {
      nodeOffsets = {};
      prevLayout = layout;
    }
  });

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

  function showTooltip(e: MouseEvent, text: string) {
    const rect = containerEl.getBoundingClientRect();
    tooltip = {
      text,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function moveTooltip(e: MouseEvent) {
    if (!tooltip) return;
    const rect = containerEl.getBoundingClientRect();
    tooltip = {
      text: tooltip.text,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function hideTooltip() {
    tooltip = null;
  }

  const ROW_HEIGHT = 28;
  const PADDING_X = 12;
  const NAME_AREA = 28;
  const ACCENT_HEIGHT = 3;

  const HEADER_BG = '#252538';
  const BODY_BG = '#1e1e2e';

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

  const TABLE_COLORS = [
    '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8',
    '#cba6f7', '#fab387', '#94e2d5', '#74c7ec',
  ];

  const GROUP_COLORS = [
    '#89b4fa', '#a6e3a1', '#cba6f7', '#94e2d5',
    '#fab387', '#f9e2af', '#f38ba8', '#74c7ec',
  ];

  function getGroupColor(group: LayoutGroup, index: number): string {
    return group.color || GROUP_COLORS[index % GROUP_COLORS.length];
  }

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

  function relationLabel(relation: string): string {
    if (relation === '*') return 'N';
    if (relation === '1') return '1';
    return relation;
  }

  const LABEL_OFFSET = 30;

  function labelPos(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return from;
    const t = Math.min(LABEL_OFFSET / len, 0.4);
    return { x: from.x + dx * t, y: from.y + dy * t };
  }

  // Get rendered position for a node (layout pos + drag offset)
  function nodeX(node: LayoutNode): number {
    return node.x + (nodeOffsets[node.id]?.dx ?? 0);
  }

  function nodeY(node: LayoutNode): number {
    return node.y + (nodeOffsets[node.id]?.dy ?? 0);
  }

  // Build a nodeId->tableName lookup from the ref's fromTable/toTable
  // Node ids are "schema.tableName", edges reference fromTable/toTable as table names
  function edgeNodeIds(edge: LayoutEdge): { fromId: string; toId: string } {
    return {
      fromId: `${edge.ref.fromSchema}.${edge.ref.fromTable}`,
      toId: `${edge.ref.toSchema}.${edge.ref.toTable}`,
    };
  }

  // Adjust edge points while preserving orthogonal (right-angle) routing.
  // Offsets propagate from each end through alternating h/v segments:
  // horizontal segments carry dy, vertical segments carry dx.
  function adjustedPoints(edge: LayoutEdge): { x: number; y: number }[] {
    const { fromId, toId } = edgeNodeIds(edge);
    const fromOff = nodeOffsets[fromId] ?? { dx: 0, dy: 0 };
    const toOff = nodeOffsets[toId] ?? { dx: 0, dy: 0 };

    if (fromOff.dx === 0 && fromOff.dy === 0 && toOff.dx === 0 && toOff.dy === 0) {
      return edge.points;
    }

    const pts = edge.points;
    const n = pts.length;

    if (n <= 1) return pts.map((p) => ({ x: p.x + fromOff.dx, y: p.y + fromOff.dy }));

    if (n === 2) {
      // Straight line — expand into a stepped orthogonal path
      const p0 = { x: pts[0].x + fromOff.dx, y: pts[0].y + fromOff.dy };
      const p1 = { x: pts[1].x + toOff.dx, y: pts[1].y + toOff.dy };
      const isH = Math.abs(pts[1].x - pts[0].x) >= Math.abs(pts[1].y - pts[0].y);

      if (isH) {
        // Was horizontal — step via vertical in the middle
        const midX = (p0.x + p1.x) / 2;
        return [p0, { x: midX, y: p0.y }, { x: midX, y: p1.y }, p1];
      } else {
        // Was vertical — step via horizontal in the middle
        const midY = (p0.y + p1.y) / 2;
        return [p0, { x: p0.x, y: midY }, { x: p1.x, y: midY }, p1];
      }
    }

    // Determine segment orientations (horizontal vs vertical)
    const segH: boolean[] = [];
    for (let i = 0; i < n - 1; i++) {
      segH.push(Math.abs(pts[i + 1].x - pts[i].x) >= Math.abs(pts[i + 1].y - pts[i].y));
    }

    // Propagate from-offset forward: horizontal segments pass dy, vertical pass dx
    const fwd: { dx: number; dy: number }[] = new Array(n);
    fwd[0] = { dx: fromOff.dx, dy: fromOff.dy };
    for (let i = 1; i < n; i++) {
      if (segH[i - 1]) {
        fwd[i] = { dx: 0, dy: fwd[i - 1].dy };
      } else {
        fwd[i] = { dx: fwd[i - 1].dx, dy: 0 };
      }
    }

    // Propagate to-offset backward
    const bwd: { dx: number; dy: number }[] = new Array(n);
    bwd[n - 1] = { dx: toOff.dx, dy: toOff.dy };
    for (let i = n - 2; i >= 0; i--) {
      if (segH[i]) {
        bwd[i] = { dx: 0, dy: bwd[i + 1].dy };
      } else {
        bwd[i] = { dx: bwd[i + 1].dx, dy: 0 };
      }
    }

    // Combine both propagations
    return pts.map((pt, i) => ({
      x: pt.x + fwd[i].dx + bwd[i].dx,
      y: pt.y + fwd[i].dy + bwd[i].dy,
    }));
  }

  // --- Node dragging ---

  function onNodeMouseDown(e: MouseEvent, node: LayoutNode) {
    // Only left button
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    draggingNodeId = node.id;
    const startX = e.clientX;
    const startY = e.clientY;
    const startDx = nodeOffsets[node.id]?.dx ?? 0;
    const startDy = nodeOffsets[node.id]?.dy ?? 0;

    // Get current zoom transform to account for scale
    const gTransform = gEl.getAttribute('transform') || '';
    const scaleMatch = gTransform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

    const onMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      nodeOffsets = {
        ...nodeOffsets,
        [node.id]: { dx: startDx + dx, dy: startDy + dy },
      };
    };

    const onMouseUp = () => {
      draggingNodeId = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // --- Export helpers ---

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  function fitToContent(padding = 40) {
    if (!svgEl || !gEl || !zoomBehavior) return;
    const box = gEl.getBBox();
    if (box.width === 0 || box.height === 0) return;

    const svgWidth = svgEl.clientWidth;
    const svgHeight = svgEl.clientHeight;

    const scale = Math.min(
      (svgWidth - padding * 2) / box.width,
      (svgHeight - padding * 2) / box.height,
      1
    );

    const tx = svgWidth / 2 - scale * (box.x + box.width / 2);
    const ty = svgHeight / 2 - scale * (box.y + box.height / 2);

    const transform = zoomIdentity.translate(tx, ty).scale(scale);
    (select(svgEl) as any).transition().duration(300).call(zoomBehavior.transform as any, transform);
  }

  // Set up zoom
  $effect(() => {
    if (!svgEl || !gEl) return;

    zoomBehavior = zoom()
      .scaleExtent([0.05, 4])
      .filter((event) => {
        // Allow scroll wheel for zoom
        if (event.type === 'wheel') return true;
        // Only allow right-click drag for panning
        if (event.type === 'mousedown') return event.button === 2;
        // Allow touchstart for mobile
        if (event.type === 'touchstart') return true;
        return true;
      })
      .on('zoom', (event) => {
        select(gEl).attr('transform', event.transform);
      });

    select(svgEl).call(zoomBehavior as any);

    // Prevent context menu on the SVG so right-click drag works
    svgEl.addEventListener('contextmenu', (e) => e.preventDefault());

    return () => {
      select(svgEl).on('.zoom', null);
    };
  });

  // Fit to content when layout changes
  $effect(() => {
    if (!layout || !svgEl || !gEl) return;
    queueMicrotask(() => fitToContent());
  });
</script>

<div bind:this={containerEl} class="relative h-full w-full bg-[#11111b]">
  <div class="absolute top-3 right-3 z-10 flex gap-2">
    <button
      onclick={() => { onlayout(); }}
      class="rounded bg-[#313244] px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
    >
      Auto Layout
    </button>
    <button
      onclick={() => fitToContent()}
      class="rounded bg-[#313244] px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
    >
      Fit
    </button>
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
    <button
      onclick={() => downloadModalOpen = true}
      class="rounded bg-[#313244] px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
    >
      Download Image
    </button>
    <button
      onclick={handleShare}
      class="rounded px-3 py-1.5 text-xs transition-colors {shareCopied ? 'bg-[#a6e3a1] text-[#1e1e2e]' : 'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]'}"
    >
      {shareCopied ? 'Copied!' : 'Share'}
    </button>
  </div>

  {#if tooltip}
    <div
      class="pointer-events-none absolute z-20 max-w-[240px] rounded-md px-3 py-1.5 text-xs shadow-lg"
      style="left: {tooltip.x + 12}px; top: {tooltip.y - 8}px; background: #313244; color: #cdd6f4; border: 1px solid #45475a;"
    >
      {tooltip.text}
    </div>
  {/if}

  <svg bind:this={svgEl} class="h-full w-full">
    <defs>
      <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="1" fill="#313244" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
    <g bind:this={gEl}>
      {#if layout}
        <!-- Group backgrounds (render behind everything) -->
        {#each layout.groups as group, gi}
          {@const color = getGroupColor(group, gi)}
          <g transform="translate({group.x}, {group.y})">
            <!-- Group background rect -->
            <rect
              width={group.width}
              height={group.height}
              rx="10"
              ry="10"
              fill={color}
              opacity="0.08"
              stroke={color}
              stroke-width="1.5"
              stroke-opacity="0.3"
            />
            <!-- Group label -->
            <text
              x="14"
              y="22"
              fill={color}
              font-weight="bold"
              font-size="13"
              font-family="'JetBrains Mono', 'Fira Code', monospace"
              opacity="0.9"
            >
              {group.name}
            </text>
          </g>
        {/each}

        <!-- Edge lines (render behind everything else) -->
        {#each layout.edges as edge}
          {@const pts = adjustedPoints(edge)}
          {@const isHovered = hoveredEdgeId === edge.id}
          {@const isDimmed = hoveredEdgeId !== null && !isHovered}

          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            onmouseenter={() => hoveredEdgeId = edge.id}
            onmouseleave={() => { if (hoveredEdgeId === edge.id) hoveredEdgeId = null; }}
          >
            <!-- Wide invisible hit area -->
            <path
              d={buildEdgePath(pts)}
              fill="none"
              stroke="transparent"
              stroke-width="12"
            />

            <!-- Visible base line -->
            <path
              d={buildEdgePath(pts)}
              fill="none"
              stroke={isHovered ? '#89b4fa' : '#585b70'}
              stroke-width={isHovered ? 2 : 1.5}
              opacity={isDimmed ? 0.25 : 1}
              style="transition: stroke 0.15s, stroke-width 0.15s, opacity 0.15s;"
            />

            <!-- Animated dash overlay when hovered -->
            {#if isHovered}
              <path
                d={buildEdgePath(pts)}
                fill="none"
                stroke="#89b4fa"
                stroke-width="2"
                stroke-dasharray="6 4"
                opacity="0.8"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="10"
                  to="0"
                  dur="0.4s"
                  repeatCount="indefinite"
                />
              </path>
            {/if}
          </g>
        {/each}

        <!-- Cardinality bubbles (rendered above all lines) -->
        {#each layout.edges as edge}
          {@const pts = adjustedPoints(edge)}
          {@const isHovered = hoveredEdgeId === edge.id}
          {@const isDimmed = hoveredEdgeId !== null && !isHovered}

          {#if pts.length >= 2}
            {@const fromPos = labelPos(pts[0], pts[1])}
            {@const toPos = labelPos(pts[pts.length - 1], pts[pts.length - 2])}
            {@const fromLabel = relationLabel(edge.ref.fromRelation)}
            {@const toLabel = relationLabel(edge.ref.toRelation)}

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- From cardinality bubble -->
            <g
              opacity={isDimmed ? 0.25 : 1}
              style="transition: opacity 0.15s;"
              onmouseenter={() => hoveredEdgeId = edge.id}
              onmouseleave={() => { if (hoveredEdgeId === edge.id) hoveredEdgeId = null; }}
            >
              <rect
                x={fromPos.x - 10}
                y={fromPos.y - 8}
                width="20"
                height="16"
                rx="8"
                ry="8"
                fill={isHovered ? '#89b4fa' : '#313244'}
                stroke={isHovered ? '#89b4fa' : '#45475a'}
                stroke-width="1"
                style="transition: fill 0.15s, stroke 0.15s;"
              />
              <text
                x={fromPos.x}
                y={fromPos.y}
                text-anchor="middle"
                dy="0.35em"
                fill={isHovered ? '#1e1e2e' : '#cdd6f4'}
                font-size="10"
                font-weight="bold"
                font-family="'JetBrains Mono', 'Fira Code', monospace"
                style="transition: fill 0.15s;"
              >{fromLabel}</text>
            </g>

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- To cardinality bubble -->
            <g
              opacity={isDimmed ? 0.25 : 1}
              style="transition: opacity 0.15s;"
              onmouseenter={() => hoveredEdgeId = edge.id}
              onmouseleave={() => { if (hoveredEdgeId === edge.id) hoveredEdgeId = null; }}
            >
              <rect
                x={toPos.x - 10}
                y={toPos.y - 8}
                width="20"
                height="16"
                rx="8"
                ry="8"
                fill={isHovered ? '#89b4fa' : '#313244'}
                stroke={isHovered ? '#89b4fa' : '#45475a'}
                stroke-width="1"
                style="transition: fill 0.15s, stroke 0.15s;"
              />
              <text
                x={toPos.x}
                y={toPos.y}
                text-anchor="middle"
                dy="0.35em"
                fill={isHovered ? '#1e1e2e' : '#cdd6f4'}
                font-size="10"
                font-weight="bold"
                font-family="'JetBrains Mono', 'Fira Code', monospace"
                style="transition: fill 0.15s;"
              >{toLabel}</text>
            </g>
          {/if}
        {/each}

        <!-- Table nodes -->
        {#each layout.nodes as node, i}
          {@const hh = headerHeight(node.table, node.width)}
          {@const noteLines = node.table.note ? wrapNoteText(node.table.note, node.width) : []}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            transform="translate({nodeX(node)}, {nodeY(node)})"
            onmousedown={(e) => onNodeMouseDown(e, node)}
            style="cursor: {draggingNodeId === node.id ? 'grabbing' : 'grab'};"
          >
            <clipPath id="clip-{node.id}">
              <rect width={node.width} height={node.height} rx="6" ry="6" />
            </clipPath>

            <!-- Table background -->
            <rect
              width={node.width}
              height={node.height}
              rx="6"
              ry="6"
              fill={BODY_BG}
              stroke="#313244"
              stroke-width="1"
            />

            <!-- Clipped content -->
            <g clip-path="url(#clip-{node.id})">
              <!-- Header background (slightly lighter than body) -->
              <rect
                width={node.width}
                height={hh}
                fill={HEADER_BG}
              />

              <!-- Accent line at top -->
              <rect
                width={node.width}
                height={ACCENT_HEIGHT}
                fill={node.table.headerColor || getTableColor(i)}
              />

              <!-- Header / body separator -->
              <line
                x1="0"
                y1={hh}
                x2={node.width}
                y2={hh}
                stroke="#313244"
                stroke-width="0.5"
              />

              <!-- Table name -->
              <text
                x={node.width / 2}
                y={noteLines.length > 0 ? ACCENT_HEIGHT + (NAME_AREA - ACCENT_HEIGHT) / 2 : ACCENT_HEIGHT + (hh - ACCENT_HEIGHT) / 2}
                text-anchor="middle"
                dy="0.35em"
                fill="#cdd6f4"
                font-weight="bold"
                font-size="14"
                font-family="'JetBrains Mono', 'Fira Code', monospace"
              >
                {node.table.name}
              </text>

              <!-- Table note lines in header -->
              {#each noteLines as line, li}
                <text
                  x={node.width / 2}
                  y={NAME_AREA + li * NOTE_LINE_HEIGHT + NOTE_LINE_HEIGHT / 2}
                  text-anchor="middle"
                  dy="0.35em"
                  fill="#7f849c"
                  font-size="10"
                  font-style="italic"
                  font-family="'JetBrains Mono', 'Fira Code', monospace"
                >
                  {line}
                </text>
              {/each}

              <!-- Columns -->
              {#each node.table.columns as col, ci}
                {@const rowY = hh + ci * ROW_HEIGHT}

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

                <!-- Column row -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <g
                  onmouseenter={col.note ? (e: MouseEvent) => showTooltip(e, col.note!) : undefined}
                  onmousemove={col.note ? moveTooltip : undefined}
                  onmouseleave={col.note ? hideTooltip : undefined}
                >
                  <!-- Hit area -->
                  <rect
                    x="0"
                    y={rowY}
                    width={node.width}
                    height={ROW_HEIGHT}
                    fill="transparent"
                  />

                  <text
                    x={PADDING_X}
                    y={rowY + ROW_HEIGHT / 2}
                    dy="0.35em"
                    fill={col.pk ? '#f9e2af' : '#cdd6f4'}
                    font-weight={col.pk ? 'bold' : 'normal'}
                    font-size="12"
                    font-family="'JetBrains Mono', 'Fira Code', monospace"
                  >
                    {col.pk ? '🔑 ' : ''}{col.name}
                  </text>

                  <text
                    x={node.width - PADDING_X - (col.note ? 16 : 0)}
                    y={rowY + ROW_HEIGHT / 2}
                    text-anchor="end"
                    dy="0.35em"
                    fill="#6c7086"
                    font-size="11"
                    font-family="'JetBrains Mono', 'Fira Code', monospace"
                  >
                    {col.type}
                  </text>

                  {#if col.note}
                    <circle
                      cx={node.width - PADDING_X - 5}
                      cy={rowY + ROW_HEIGHT / 2}
                      r="5.5"
                      fill="none"
                      stroke="#585b70"
                      stroke-width="1"
                    />
                    <text
                      x={node.width - PADDING_X - 5}
                      y={rowY + ROW_HEIGHT / 2}
                      text-anchor="middle"
                      dy="0.35em"
                      fill="#585b70"
                      font-size="8"
                      font-weight="bold"
                      font-style="italic"
                      font-family="Georgia, serif"
                    >i</text>
                  {/if}
                </g>
              {/each}
            </g>
          </g>
        {/each}
      {/if}
    </g>
  </svg>

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
</div>
