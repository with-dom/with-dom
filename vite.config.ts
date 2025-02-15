import { resolve } from "path";
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    dts({
      tsconfigPath: "./tsconfig.app.json",
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "With-DOM",
      fileName: "with-dom",
    },
    rollupOptions: {
      external: ['preact'],
      output: {
        globals: {
          preact: 'preact',
        }
      }
    },
  },
});
