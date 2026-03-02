<script lang="ts">
	import { page } from '$app/stores';
	import Diagram from '$lib/components/Diagram.svelte';
	import { parseDBML } from '$lib/dbml/parser';
	import { computeLayout, type LayoutResult } from '$lib/dbml/layout';

	let layout: LayoutResult | null = $state(null);
	let source = $state('');
	let hasErrors = $state(false);

	$effect(() => {
		const data = $page.data;
		if (data.source != null) {
			source = data.source as string;
			runLayout();
		}
	});

	async function runLayout() {
		const result = await parseDBML(source);
		if (result.ok) {
			hasErrors = false;
			try {
				layout = await computeLayout(result.schema, 'RIGHT');
			} catch (e) {
				console.error('Layout error:', e);
			}
		} else {
			hasErrors = true;
		}
	}
</script>

<svelte:head>
	<title>{$page.data.name ?? 'Shared Diagram'} — ScribbleDB</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="relative h-screen w-screen">
	<Diagram {layout} {source} {hasErrors} onlayout={runLayout} embed={true} />
	<a
		href="/login"
		class="absolute bottom-3 right-3 z-10 rounded bg-[#313244] px-3 py-1.5 text-xs text-[#cdd6f4] hover:bg-[#45475a] transition-colors"
	>
		Open in ScribbleDB
	</a>
</div>
