import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  resolve: {
    alias: {
      // Stubs só para o bundle do iframe DevTools (standalone importa
      // módulos Node que não existem no browser).
      ws: resolve(__dirname, "src/devtools/node-stubs/ws.ts"),
      bufferutil: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      "utf-8-validate": resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      fs: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      http: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      https: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      net: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      path: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      crypto: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      zlib: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      stream: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      os: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
      util: resolve(__dirname, "src/devtools/node-stubs/empty.ts"),
    },
  },
  define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production") },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), devtools: resolve(__dirname, "devtools.html") },
    },
  },
});
