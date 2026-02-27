<script lang="ts">
  import { untrack } from 'svelte';
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

  // Resizable split pane
  let panelWidth = $state(45);
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

  // Initial render (run once on mount, don't track source)
  $effect(() => {
    untrack(() => updateDiagram(source));
  });
</script>

<svelte:head>
  <title>DBML Schema Builder</title>
</svelte:head>

<div class="flex h-screen w-screen" class:select-none={isDragging}>
  <!-- Left: Editor panel -->
  <div class="flex flex-col overflow-hidden" style="width: {panelWidth}%">
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

  <!-- Right: Diagram panel -->
  <div class="flex-1 overflow-hidden">
    <Diagram {layout} />
  </div>
</div>
