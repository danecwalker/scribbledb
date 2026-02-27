import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id: string) {
					if (id.includes('codemirror') || id.includes('@codemirror') || id.includes('@lezer')) {
						return 'codemirror';
					}
					if (id.includes('d3-')) {
						return 'd3';
					}
				},
			},
		},
	},
});
