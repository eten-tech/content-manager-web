import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [sveltekit(), tailwindcss()],
    server: {
        port: 5273,
        strictPort: false,
    },
    build: {
        sourcemap: process.env.INCLUDE_SOURCE_MAPS === 'true',
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['src/setup-tests.ts'],
        include: ['src/**/*.{test,spec}.{js,ts}'],
    },
});
