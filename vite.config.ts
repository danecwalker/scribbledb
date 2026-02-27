import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules/@dbml/core') || id.includes('node_modules\\@dbml\\core')) return 'dbml';
					if (id.includes('node_modules/codemirror') || id.includes('node_modules\\codemirror') ||
						id.includes('node_modules/@codemirror') || id.includes('node_modules\\@codemirror')) return 'codemirror';
					if (id.includes('node_modules/elkjs') || id.includes('node_modules\\elkjs')) return 'elkjs';
				},
			},
		},
	},
});
