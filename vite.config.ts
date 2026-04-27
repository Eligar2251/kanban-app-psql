import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: ((id: string) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            if (id.includes('@supabase/postgrest-js')) {
              return 'postgrest';
            }
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('@dnd-kit')) {
              return 'dnd';
            }
          }
        }) as any,
      },
    },
  },
});