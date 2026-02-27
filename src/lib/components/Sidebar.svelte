<!-- src/lib/components/Sidebar.svelte -->
<script lang="ts">
  import type { Project } from '$lib/types';

  interface Props {
    projects: Project[];
    activeId: string | null;
    oncreate: () => void;
    onselect: (id: string) => void;
    ondelete: (id: string) => void;
    onrename: (id: string, name: string) => void;
  }

  let { projects, activeId, oncreate, onselect, ondelete, onrename }: Props = $props();

  let editingId: string | null = $state(null);
  let editingName = $state('');
  let editInput: HTMLInputElement | undefined = $state();

  // Sort projects by updatedAt descending (most recent first)
  let sorted = $derived(
    [...projects].sort((a, b) => b.updatedAt - a.updatedAt)
  );

  function startRename(project: Project) {
    editingId = project.id;
    editingName = project.name;
    // Focus the input after it renders
    requestAnimationFrame(() => editInput?.select());
  }

  function commitRename() {
    if (editingId && editingName.trim()) {
      onrename(editingId, editingName.trim());
    }
    editingId = null;
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      editingId = null;
    }
  }
</script>

<div class="flex flex-col h-full w-[220px] min-w-[220px] bg-[#181825] border-r border-[#313244]">
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-[#313244]">
    <span class="text-xs font-semibold text-[#a6adc8] uppercase tracking-wider">Projects</span>
    <button
      onclick={oncreate}
      class="flex items-center justify-center w-5 h-5 rounded text-[#a6adc8] hover:bg-[#313244] hover:text-[#cdd6f4] transition-colors"
      title="New project"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- Project list -->
  <div class="flex-1 overflow-y-auto py-1">
    {#each sorted as project (project.id)}
      <div
        class="group flex items-center gap-1 px-2 py-1 mx-1 rounded cursor-pointer text-sm transition-colors {project.id === activeId ? 'bg-[#313244] text-[#cdd6f4]' : 'text-[#a6adc8] hover:bg-[#1e1e2e] hover:text-[#cdd6f4]'}"
        onclick={() => onselect(project.id)}
        ondblclick={() => startRename(project)}
        role="button"
        tabindex="0"
        onkeydown={(e) => { if (e.key === 'Enter') onselect(project.id); }}
      >
        {#if editingId === project.id}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            bind:this={editInput}
            bind:value={editingName}
            onblur={commitRename}
            onkeydown={handleRenameKeydown}
            onclick={(e) => e.stopPropagation()}
            ondblclick={(e) => e.stopPropagation()}
            class="flex-1 min-w-0 bg-[#1e1e2e] text-[#cdd6f4] text-sm px-1 py-0 rounded border border-[#585b70] outline-none"
            autofocus
          />
        {:else}
          <span class="flex-1 min-w-0 truncate text-xs">{project.name}</span>
          {#if projects.length > 1}
            <button
              onclick={(e) => { e.stopPropagation(); ondelete(project.id); }}
              class="hidden group-hover:flex items-center justify-center w-4 h-4 rounded text-[#6c7086] hover:text-[#f38ba8] hover:bg-[#313244] transition-colors flex-shrink-0"
              title="Delete project"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>
