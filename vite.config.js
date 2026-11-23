import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Estructura del proyecto (todo arranca desde la raíz):
//   index.html  entrada de Vite (raíz)
//   front/      todo lo visual: HTML de apoyo, CSS, fuentes y sprites
//   back/       todo el código interno, separado por carpetas
// El legacy se exportó a C:\Users\omegamon\Desktop\DungeonBuild-Legacy y
// ya no forma parte del grafo de build.
export default defineConfig({
  root: '.',
  // GitHub Pages sirve el sitio bajo /DungeonInvader/. Con rutas relativas
  // el mismo build funciona en la raíz local, en `vite preview` y en Pages.
  base: './',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./back', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Los PNG se emiten como archivos: mejor para sprites y para inspección.
    assetsInlineLimit: 0,
  },
});
