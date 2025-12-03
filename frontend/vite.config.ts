// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src')
        }
    },
    server: {
        port: 3001,        // Frontend auf 3001
        open: true,
        proxy: {
            // Leite alle /api/*-Aufrufe zum Backend auf localhost:3000 weiter
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false
            }
        }
    },
    preview: {
        port: 5000
    }
});
