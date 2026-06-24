import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
    publicDir: 'public',
    build: {
        outDir: 'build',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
    },
});
