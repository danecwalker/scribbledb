<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/stores';
  import { invalidateAll } from '$app/navigation';
  import Editor from '$lib/components/Editor.svelte';
  import Diagram from '$lib/components/Diagram.svelte';
  import ErrorBar from '$lib/components/ErrorBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { parseDBML, type ParseError } from '$lib/dbml/parser';
  import { computeLayout, type LayoutResult, type LayoutDirection } from '$lib/dbml/layout';
  import type { Diagnostic } from '@codemirror/lint';
  import type { Project } from '$lib/types';
  import { initializePaddle, type Paddle } from '@paddle/paddle-js';

  const DEFAULT_DBML = `Table customers {
  id integer [pk, increment]
  email varchar(255) [unique, not null]
  name varchar(255) [not null]
  phone varchar(50)
  created_at timestamp [default: \`now()\`]

  Note: 'Registered customers'
}

Table products {
  id integer [pk, increment]
  name varchar(255) [not null]
  description text
  price decimal(10,2) [not null]
  sku varchar(100) [unique, not null, note: 'Stock keeping unit']
  category_id integer [not null]
  stock integer [default: 0]
  created_at timestamp [default: \`now()\`]

  Note: 'Product catalog'
}

Table categories {
  id integer [pk, increment]
  name varchar(100) [unique, not null]
  parent_id integer [note: 'Self-referencing for subcategories']
}

Table orders {
  id integer [pk, increment]
  customer_id integer [not null]
  status varchar [default: 'pending', note: 'pending, paid, shipped, delivered, cancelled']
  total decimal(10,2) [not null]
  shipping_address text [not null]
  placed_at timestamp [default: \`now()\`]

  Note: 'Customer orders'
}

Table order_items {
  id integer [pk, increment]
  order_id integer [not null]
  product_id integer [not null]
  quantity integer [not null, default: 1]
  unit_price decimal(10,2) [not null]

  Note: 'Line items within an order'
}

Table payments {
  id integer [pk, increment]
  order_id integer [not null]
  method varchar [not null, note: 'card, paypal, bank_transfer']
  amount decimal(10,2) [not null]
  status varchar [default: 'pending', note: 'pending, completed, refunded']
  paid_at timestamp

  Note: 'Payment transactions'
}

Table reviews {
  id integer [pk, increment]
  product_id integer [not null]
  customer_id integer [not null]
  rating integer [not null, note: '1-5 stars']
  body text
  created_at timestamp [default: \`now()\`]
}

Ref: products.category_id > categories.id
Ref: categories.parent_id > categories.id
Ref: orders.customer_id > customers.id
Ref: order_items.order_id > orders.id
Ref: order_items.product_id > products.id
Ref: payments.order_id > orders.id
Ref: reviews.product_id > products.id
Ref: reviews.customer_id > customers.id
`;

  let projects: Project[] = $state([]);
  let activeProjectId: string | null = $state(null);
  let source = $state('');
  let direction: LayoutDirection = $state('RIGHT');
  let layout: LayoutResult | null = $state(null);
  let parseErrors: ParseError[] = $state([]);
  let diagnostics: Diagnostic[] = $state([]);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let showUpgradePrompt = $state(false);

  let paddle: Paddle | undefined = $state();

  $effect(() => {
    const token = $page.data.paddleClientToken as string;
    if (token) {
      initializePaddle({
        token,
        environment: 'sandbox',
      }).then((p) => {
        if (p) paddle = p;
      });
    }
  });

  function openCheckout() {
    showUpgradePrompt = false;
    if (!paddle) return;
    const user = ($page.data as any).user;
    paddle.Checkout.open({
      items: [{ priceId: ($page.data as any).paddlePriceId ?? '', quantity: 1 }],
      customer: { email: user?.email },
      customData: { userId: user?.id },
    });
  }

  let fileInput: HTMLInputElement;

  // --- Initialize from server data on mount ---

  $effect(() => {
    untrack(() => {
      const data = $page.data;
      if (!data.projects) return;

      projects = data.projects as Project[];

      if (projects.length > 0) {
        activeProjectId = projects[0].id;
        source = projects[0].source;
      }

      // Check for shared diagram in URL hash
      const hash = window.location.hash;
      if (hash.startsWith('#share=')) {
        const encoded = hash.slice('#share='.length);
        decompressFromURL(encoded).then(async (dbml) => {
          // Create the shared project on the server
          const res = await fetch('?/create', {
            method: 'POST',
            body: new FormData(),
            headers: { 'x-sveltekit-action': 'true' },
          });
          const result = await res.json();

          if (result.type === 'success') {
            await invalidateAll();
            const refreshed = $page.data;
            const newest = (refreshed.projects as Project[])?.[0];
            if (newest) {
              // Update the new project with shared diagram data
              const form = new FormData();
              form.set('id', newest.id);
              form.set('name', 'Shared Diagram');
              form.set('source', dbml);
              await fetch('?/update', {
                method: 'POST',
                body: form,
                headers: { 'x-sveltekit-action': 'true' },
              });
              await invalidateAll();
              projects = ($page.data.projects as Project[]) ?? [];
              const updated = projects.find((p) => p.id === newest.id);
              if (updated) {
                activeProjectId = updated.id;
                source = updated.source;
              }
            }
          }

          history.replaceState(null, '', window.location.pathname);
          runLayout();
        });
      } else {
        runLayout();
      }
    });
  });

  // --- Server-backed Project CRUD ---

  async function createProject() {
    const res = await fetch('?/create', {
      method: 'POST',
      body: new FormData(),
      headers: { 'x-sveltekit-action': 'true' },
    });
    const result = await res.json();

    if (result.type === 'success') {
      await invalidateAll();
      const data = $page.data;
      projects = (data.projects as Project[]) ?? [];
      const newest = projects[0];
      if (newest) {
        activeProjectId = newest.id;
        source = newest.source;
        runLayout();
      }
    } else if (result.type === 'failure' && result.data?.error) {
      showUpgradePrompt = true;
    }
  }

  function selectProject(id: string) {
    if (id === activeProjectId) return;
    flushPendingSave();
    activeProjectId = id;
    const project = projects.find((p) => p.id === id);
    if (project) {
      source = project.source;
      runLayout();
    }
  }

  async function deleteProject(id: string) {
    if (projects.length <= 1) return;
    const form = new FormData();
    form.set('id', id);
    await fetch('?/delete', {
      method: 'POST',
      body: form,
      headers: { 'x-sveltekit-action': 'true' },
    });

    await invalidateAll();
    const data = $page.data;
    projects = (data.projects as Project[]) ?? [];
    if (id === activeProjectId && projects.length > 0) {
      activeProjectId = projects[0].id;
      source = projects[0].source;
      runLayout();
    }
  }

  async function renameProject(id: string, name: string) {
    // Update local state immediately for responsiveness
    projects = projects.map((p) => (p.id === id ? { ...p, name } : p));

    const form = new FormData();
    form.set('id', id);
    form.set('name', name);
    await fetch('?/update', {
      method: 'POST',
      body: form,
      headers: { 'x-sveltekit-action': 'true' },
    });
  }

  // --- File import ---

  function importFile() {
    fileInput.click();
  }

  function handleFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      source = text;
      runLayout();
    };
    reader.readAsText(file);
    (e.target as HTMLInputElement).value = '';
  }

  // --- Resizable split pane ---

  const SIDEBAR_WIDTH = 220;
  let panelWidth = $state(45);
  let isDragging = $state(false);
  let editorCollapsed = $state(false);

  function onDividerMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;

    const onMouseMove = (e: MouseEvent) => {
      const remainingWidth = window.innerWidth - SIDEBAR_WIDTH;
      if (remainingWidth <= 0) return;
      const pct = ((e.clientX - SIDEBAR_WIDTH) / remainingWidth) * 100;
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

  // --- Source change + auto-save ---

  let pendingSave: { projectId: string; source: string } | null = null;

  function flushPendingSave() {
    if (saveTimer && pendingSave) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      const { projectId, source: src } = pendingSave;
      pendingSave = null;
      const form = new FormData();
      form.set('id', projectId);
      form.set('source', src);
      fetch('?/update', {
        method: 'POST',
        body: form,
        headers: { 'x-sveltekit-action': 'true' },
      });
    }
  }

  function handleSourceChange(newSource: string) {
    const projectId = activeProjectId; // capture before timeout

    // Update local state immediately
    if (projectId) {
      projects = projects.map((p) =>
        p.id === projectId ? { ...p, source: newSource } : p
      );
    }

    // Debounced server save
    clearTimeout(saveTimer);
    pendingSave = projectId ? { projectId, source: newSource } : null;
    saveTimer = setTimeout(() => {
      if (pendingSave) {
        const { projectId: pid, source: src } = pendingSave;
        pendingSave = null;
        const form = new FormData();
        form.set('id', pid);
        form.set('source', src);
        fetch('?/update', {
          method: 'POST',
          body: form,
          headers: { 'x-sveltekit-action': 'true' },
        }).catch(() => {
          // TODO: show save error indicator
          console.error('Failed to save project');
        });
      }
    }, 1000);

    // Debounced parse
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      parseSource(newSource);
    }, 300);
  }

  // --- Parsing (runs on every source change) ---

  let lastParsedSchema: import('$lib/dbml/parser').ParsedSchema | null = null;

  async function parseSource(dbml: string) {
    const result = await parseDBML(dbml);

    if (result.ok) {
      parseErrors = [];
      diagnostics = [];
      lastParsedSchema = result.schema;
    } else {
      parseErrors = result.errors;
      diagnostics = result.errors.map((err) => {
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

  // --- Share helpers ---

  async function compressToURL(): Promise<string> {
    const bytes = new TextEncoder().encode(source);
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const compressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      compressed.set(c, offset);
      offset += c.length;
    }
    // base64url encode
    let binary = '';
    for (const b of compressed) binary += String.fromCharCode(b);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${window.location.origin}${window.location.pathname}#share=${encoded}`;
  }

  async function decompressFromURL(encoded: string): Promise<string> {
    // base64url decode
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const decompressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      decompressed.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(decompressed);
  }

  async function shareDiagram() {
    const url = await compressToURL();
    await navigator.clipboard.writeText(url);
  }

  // --- Layout (runs on button click) ---

  async function runLayout() {
    parseSource(source);
    if (!lastParsedSchema) return;
    try {
      layout = await computeLayout(lastParsedSchema, direction);
    } catch (e) {
      console.error('Layout error:', e);
    }
  }
</script>

<svelte:head>
  <title>ScribbleDB</title>
</svelte:head>

<input
  bind:this={fileInput}
  type="file"
  accept=".dbml"
  class="hidden"
  onchange={handleFileSelect}
/>

<div class="relative flex h-screen w-screen" class:select-none={isDragging}>
  <!-- Sidebar -->
  <Sidebar
    {projects}
    activeId={activeProjectId}
    projectLimit={($page.data.plan as any)?.projectLimit ?? 3}
    oncreate={createProject}
    onselect={selectProject}
    ondelete={deleteProject}
    onrename={renameProject}
  />

  <!-- Main content area (editor + divider + diagram) -->
  <div class="flex flex-1 min-w-0">
    {#if !editorCollapsed}
      <!-- Left: Editor panel -->
      <div class="flex flex-col overflow-hidden" style="width: {panelWidth}%">
        <div class="flex items-center gap-2 bg-[#181825] px-3 py-1.5 border-b border-[#313244]">
          <button
            onclick={importFile}
            class="rounded bg-[#313244] px-3 py-1 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
          >
            Import .dbml
          </button>
          <select
            bind:value={direction}
            onchange={() => runLayout()}
            class="rounded bg-[#313244] px-2 py-1 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors border-none outline-none cursor-pointer"
          >
            <option value="RIGHT">Left → Right</option>
            <option value="LEFT">Right → Left</option>
            <option value="DOWN">Top → Bottom</option>
            <option value="UP">Bottom → Top</option>
          </select>
          <div class="flex-1"></div>
          <button
            onclick={() => editorCollapsed = true}
            class="rounded bg-[#313244] px-2 py-1 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
            title="Collapse editor"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <Editor bind:value={source} {diagnostics} onchange={handleSourceChange} />
        </div>
        <ErrorBar errors={parseErrors} />
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- Drag handle -->
      <div
        class="w-1 cursor-col-resize bg-[#313244] hover:bg-[#585b70] transition-colors flex-shrink-0"
        onmousedown={onDividerMouseDown}
        role="separator"
        aria-orientation="vertical"
      ></div>
    {/if}

    <!-- Right: Diagram panel -->
    <div class="flex-1 overflow-hidden relative">
      {#if editorCollapsed}
        <button
          onclick={() => editorCollapsed = false}
          class="absolute top-2 left-2 z-10 rounded bg-[#313244] px-2 py-1 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
          title="Expand editor"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      {/if}
      <Diagram {layout} {source} hasErrors={parseErrors.length > 0} onlayout={runLayout} onshare={shareDiagram} />
    </div>
  </div>

  {#if showUpgradePrompt}
    <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="rounded-lg bg-[#181825] p-6 border border-[#313244] max-w-sm text-center">
        <h2 class="text-lg font-semibold text-[#cdd6f4] mb-2">Project limit reached</h2>
        <p class="text-sm text-[#a6adc8] mb-4">
          Free accounts can have up to 3 projects. Upgrade to Pro for unlimited projects.
        </p>
        <div class="flex gap-3 justify-center">
          <button
            onclick={() => showUpgradePrompt = false}
            class="rounded border border-[#313244] px-4 py-2 text-sm text-[#cdd6f4] hover:bg-[#313244]"
          >
            Cancel
          </button>
          <button
            onclick={openCheckout}
            class="rounded bg-[#89b4fa] px-4 py-2 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec]"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
