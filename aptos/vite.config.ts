import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { Buffer } from "buffer";

export default defineConfig({
  build: {
    outDir: "dist",
  },
  server: {
    open: true,
  },
  plugins: [
    react(),
    VitePWA({
      disable: false,
      registerType: "autoUpdate",
      manifest: {
        name: "Aptos Fullstack Template",
        short_name: "Aptos Template",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend"),
    },
  },
  define: {
    // Properly define Buffer as global constructor
    'global.Buffer': JSON.stringify(Buffer),
    'Buffer': JSON.stringify(Buffer)
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: [
        {
          name: 'buffer-shim',
          setup(build) {
            build.onLoad({ filter: /.*/ }, (args) => {
              if (args.path.endsWith('?buffer-shim')) {
                return {
                  contents: `export const Buffer = window.Buffer;`,
                  loader: 'js'
                }
              }
            })
          }
        }
      ]
    }
  }
});
