<script lang="ts">
  import { untrack } from 'svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Diagram from '$lib/components/Diagram.svelte';
  import ErrorBar from '$lib/components/ErrorBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { parseDBML, type ParseError } from '$lib/dbml/parser';
  import { computeLayout, type LayoutResult, type LayoutDirection } from '$lib/dbml/layout';
  import type { Diagnostic } from '@codemirror/lint';
  import type { Project } from '$lib/types';

  const STORAGE_KEY = 'scribbledb-projects';
  const ACTIVE_KEY = 'scribbledb-active-project';

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
  let source = $state(DEFAULT_DBML);
  let direction: LayoutDirection = $state('RIGHT');
  let layout: LayoutResult | null = $state(null);
  let parseErrors: ParseError[] = $state([]);
  let diagnostics: Diagnostic[] = $state([]);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let fileInput: HTMLInputElement;

  // --- localStorage helpers ---

  function saveProjects() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  function saveActiveId() {
    if (activeProjectId) {
      localStorage.setItem(ACTIVE_KEY, activeProjectId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }

  // --- Load from localStorage on mount ---

  $effect(() => {
    untrack(() => {
      let stored: Project[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch {}

      if (stored.length === 0) {
        // Create default project
        const defaultProject: Project = {
          id: crypto.randomUUID(),
          name: 'Untitled',
          source: DEFAULT_DBML,
          updatedAt: Date.now(),
        };
        stored = [defaultProject];
      }

      projects = stored;
      saveProjects();

      // Restore active project
      const savedActiveId = localStorage.getItem(ACTIVE_KEY);
      const activeProject = savedActiveId
        ? stored.find((p) => p.id === savedActiveId)
        : null;

      if (activeProject) {
        activeProjectId = activeProject.id;
        source = activeProject.source;
      } else {
        // Fall back to first project
        activeProjectId = stored[0].id;
        source = stored[0].source;
      }
      saveActiveId();

      // Check for shared diagram in URL hash
      const hash = window.location.hash;
      if (hash.startsWith('#share=')) {
        const encoded = hash.slice('#share='.length);
        decompressFromURL(encoded).then((dbml) => {
          const sharedProject: Project = {
            id: crypto.randomUUID(),
            name: 'Shared Diagram',
            source: dbml,
            updatedAt: Date.now(),
          };
          projects = [...projects, sharedProject];
          activeProjectId = sharedProject.id;
          source = sharedProject.source;
          saveProjects();
          saveActiveId();
          history.replaceState(null, '', window.location.pathname);
          runLayout();
        });
      } else {
        runLayout();
      }
    });
  });

  // --- Project CRUD ---

  function createProject() {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: 'Untitled',
      source: '',
      updatedAt: Date.now(),
    };
    projects = [...projects, newProject];
    activeProjectId = newProject.id;
    source = newProject.source;
    saveProjects();
    saveActiveId();
    runLayout();
  }

  function selectProject(id: string) {
    if (id === activeProjectId) return;
    activeProjectId = id;
    const project = projects.find((p) => p.id === id);
    if (project) {
      source = project.source;
      saveActiveId();
      runLayout();
    }
  }

  function deleteProject(id: string) {
    if (projects.length <= 1) return;
    const idx = projects.findIndex((p) => p.id === id);
    projects = projects.filter((p) => p.id !== id);
    if (id === activeProjectId) {
      // Switch to next or previous project
      const newIdx = Math.min(idx, projects.length - 1);
      activeProjectId = projects[newIdx].id;
      source = projects[newIdx].source;
      runLayout();
    }
    saveProjects();
    saveActiveId();
  }

  function renameProject(id: string, name: string) {
    projects = projects.map((p) =>
      p.id === id ? { ...p, name, updatedAt: Date.now() } : p
    );
    saveProjects();
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

  function handleSourceChange(newSource: string) {
    // Auto-save to active project
    if (activeProjectId) {
      projects = projects.map((p) =>
        p.id === activeProjectId
          ? { ...p, source: newSource, updatedAt: Date.now() }
          : p
      );
      saveProjects();
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      parseSource(newSource);
    }, 300);
  }

  // --- Parsing (runs on every source change) ---

  let lastParsedSchema: import('$lib/dbml/parser').ParsedSchema | null = null;

  function parseSource(dbml: string) {
    const result = parseDBML(dbml);

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

<div class="flex h-screen w-screen" class:select-none={isDragging}>
  <!-- Sidebar -->
  <Sidebar
    {projects}
    activeId={activeProjectId}
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
</div>
