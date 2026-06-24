import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,  // Different port from desktop (5173) so both can run together
    },
    build: {
        outDir: 'build',
        emptyOutDir: true,
    },
});
