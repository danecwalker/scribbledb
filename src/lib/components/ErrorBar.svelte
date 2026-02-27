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
