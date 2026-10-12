import path from "path";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

/** Single-bundle build of the real client wired to the in-browser demo backend (see client/src/demo/mockServer.ts). */
export default mergeConfig(
  base,
  defineConfig({
    define: {
      "import.meta.env.VITE_DEMO": "true",
      // server/safety.ts (shared with the demo) reads process.env; there is none in a browser.
      "process.env": "{}",
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist-demo"),
      emptyOutDir: true,
      cssCodeSplit: false,
      sourcemap: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  })
);
