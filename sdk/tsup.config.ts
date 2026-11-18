import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/expo.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  // react-native/react-devtools-core só existem no runtime do device (Metro resolve); nunca bundlar.
  external: ["react-native", "react-devtools-core"],
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
});
