import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isNative = mode === 'native';
  return {
    publicDir: isNative ? 'public-native' : 'public',
    server: {
      host: true,
      port: 5173,
    },
    plugins: [
      tailwindcss(),
      react(),
    ],
    build: {
      emptyOutDir: true,
    },
  };
});
