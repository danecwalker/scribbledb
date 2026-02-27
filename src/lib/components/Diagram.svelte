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
